import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel, StatusBadge, ValidationErrors } from '../components/shared.js';

export function RepairRoom({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  // Fallback matches the real seeded job id (packages/database/src/seed.ts) — the old "job-1"
  // fixture id no longer resolves under real Postgres persistence (verified live: 403s).
  const { id = '44444444-4444-4444-8444-444444444444' } = useParams();
  const queryClient = useQueryClient();
  const job = useQuery({ queryKey: ['job', id, actorKey], queryFn: () => api.getJob(id) });
  // Job now carries a real quoteId (CR-002, resolved) — fetched unconditionally with `enabled`
  // gating it, not inside a conditional after the early returns below, since hooks can't be
  // called conditionally. quoteId is undefined until `job` resolves, so this simply doesn't fire
  // until there's a real id to fetch.
  const quoteId = job.data?.data.quoteId;
  const quote = useQuery({
    queryKey: ['quote', quoteId, actorKey],
    queryFn: () => api.getQuote(quoteId as string),
    enabled: Boolean(quoteId)
  });
  const findings = useQuery({ queryKey: ['findings', id, actorKey], queryFn: () => api.listFindings(id) });
  const messages = useQuery({ queryKey: ['messages', id, actorKey], queryFn: () => api.listMessages(id) });
  // GET /invoices is customer-only (verified live via curl: 403 for mechanic/admin) and returns
  // every invoice for the customer, not scoped to a job — enabled only for the customer role, and
  // filtered client-side to this job below, same pattern VehiclePassport uses for its list-only API.
  const invoices = useQuery({
    queryKey: ['invoices', actorKey],
    queryFn: () => api.listInvoices(),
    enabled: actorKey === 'customer'
  });
  const [message, setMessage] = useState('');
  const sendMessage = useMutation({ mutationFn: () => api.sendMessage(id, message), onSuccess: () => { setMessage(''); void queryClient.invalidateQueries({ queryKey: ['messages', id, actorKey] }); } });

  // Mechanic-only controls below. The contract's JobTransition schema declares `status` as a
  // plain string with no enum (openapi.yaml), so there's no fixed list of valid target statuses
  // to offer as a dropdown — a free-text field is the honest choice, not a guessed set of options.
  const [nextStatus, setNextStatus] = useState('');
  const transitionJob = useMutation({
    // job.data is guaranteed set by the time this fires — the transition control only renders
    // after the loading/error early returns below, once job.data is confirmed present.
    mutationFn: () => api.transitionJob(id, { expectedVersion: job.data?.data.version ?? 0, status: nextStatus.trim() }),
    onSuccess: () => { setNextStatus(''); void queryClient.invalidateQueries({ queryKey: ['job', id, actorKey] }); },
    onError: () => void queryClient.invalidateQueries({ queryKey: ['job', id, actorKey] })
  });

  const [findingCategory, setFindingCategory] = useState('');
  const [findingNote, setFindingNote] = useState('');
  const addFinding = useMutation({
    // Cast is safe: the submit button stays disabled until findingCategory is non-empty, and the
    // <select> below only offers the three real enum values as non-empty options.
    mutationFn: () =>
      api.addFinding(id, {
        category: findingCategory as 'recommended_now' | 'plan_for_later' | 'monitor',
        note: findingNote.trim()
      }),
    onSuccess: () => {
      setFindingCategory('');
      setFindingNote('');
      void queryClient.invalidateQueries({ queryKey: ['findings', id, actorKey] });
    }
  });

  const [completionSummary, setCompletionSummary] = useState('');
  const completeJob = useMutation({
    mutationFn: () => api.completeJob(id, { summary: completionSummary.trim() }),
    onSuccess: () => {
      setCompletionSummary('');
      void queryClient.invalidateQueries({ queryKey: ['job', id, actorKey] });
    }
  });
  // Called before the early returns below (loading/error) so it runs on every render, same as
  // every other hook — conditionally calling hooks after an early return breaks React's rules.
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();

  // quoteId/expectedVersion now come from the real fetched quote (CR-002 resolved), not
  // hardcoded — this also means a 409 is genuinely recoverable now: invalidating the quote query
  // on error re-fetches the actual current version, so a retry uses real data instead of the
  // same stale guess. Once accepted, hide the action instead of letting a second click retry.
  const acceptQuote = useMutation({
    mutationFn: (input: { quoteId: string; expectedVersion: number }) =>
      api.acceptQuote(input.quoteId, { expectedVersion: input.expectedVersion, idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['job', id, actorKey] });
      void queryClient.invalidateQueries({ queryKey: ['quote', quoteId, actorKey] });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: ['quote', quoteId, actorKey] })
  });

  if (job.isPending) return <p role="status">Loading Repair Room&hellip;</p>;
  if (job.isError) return <ErrorPanel error={job.error} onRetry={() => job.refetch()} />;

  const record = job.data.data;
  // allowedActions is optional on the real API (verified live: a freshly seeded job's response
  // omits it entirely) — default to an empty array rather than assuming it's always present.
  const allowedActions = record.allowedActions ?? [];
  const canOfferApproval = allowedActions.includes('approve_change_order') && !acceptQuote.isSuccess && Boolean(quote.data);

  return (
    <section aria-labelledby="repair-room-heading">
      <h1
        id="repair-room-heading"
        ref={headingRef}
        className={`page-heading${headingInView ? ' is-in-view' : ''}`}
      >
        Repair Room
      </h1>
      <p>
        Status: <StatusBadge status={record.status} /> &middot; version {record.version}
      </p>
      <p>Allowed actions: {allowedActions.length ? allowedActions.join(', ') : 'none yet'}</p>

      {quote.isPending && quoteId && <p role="status">Loading quote&hellip;</p>}
      {quote.isError && <ErrorPanel error={quote.error} onRetry={() => quote.refetch()} />}
      {canOfferApproval && quote.data && (
        <button
          onClick={() =>
            acceptQuote.mutate({ quoteId: quote.data.data.id, expectedVersion: quote.data.data.version })
          }
          disabled={acceptQuote.isPending}
        >
          {acceptQuote.isPending
            ? 'Approving…'
            : `Approve quote — $${(quote.data.data.totalMinor / 100).toFixed(2)}`}
        </button>
      )}
      {acceptQuote.isError && <ValidationErrors error={acceptQuote.error} isQuoteApproval />}
      {acceptQuote.isSuccess && (
        <p role="status">Quote accepted &mdash; total ${(acceptQuote.data.data.totalMinor / 100).toFixed(2)}.</p>
      )}

      <section aria-labelledby="findings-heading">
        <h2 id="findings-heading">Inspection findings</h2>
          {findings.isPending && <p role="status">Loading findings…</p>}
          {findings.isError && <ErrorPanel error={findings.error} onRetry={() => findings.refetch()} />}
          {findings.data?.data.length === 0 && <p className="pending-note">No inspection findings have been recorded.</p>}
          {findings.data?.data.map((finding, index) => <p key={String(finding.id ?? index)}>{String(finding.note ?? 'Finding recorded')}</p>)}
          {actorKey === 'mechanic' && (
            <form
              className="intake-step"
              onSubmit={(event) => {
                event.preventDefault();
                addFinding.mutate();
              }}
            >
              <label>
                Category
                {/* openapi.yaml declares category as a plain string with no enum, but the live API
                    rejects anything outside this set (confirmed via curl: 422 "Invalid enum value.
                    Expected 'recommended_now' | 'plan_for_later' | 'monitor'") — using the real
                    values rather than the contract's (wrong) free-text implication. */}
                <select value={findingCategory} onChange={(event) => setFindingCategory(event.target.value)}>
                  <option value="">Select a category&hellip;</option>
                  <option value="recommended_now">Recommended now</option>
                  <option value="plan_for_later">Plan for later</option>
                  <option value="monitor">Monitor</option>
                </select>
              </label>
              <label>
                Note
                <textarea rows={2} value={findingNote} onChange={(event) => setFindingNote(event.target.value)} placeholder="What did you find?" />
              </label>
              <button type="submit" disabled={!findingCategory.trim() || !findingNote.trim() || addFinding.isPending}>
                {addFinding.isPending ? 'Adding…' : 'Add finding'}
              </button>
              {addFinding.isError && <ValidationErrors error={addFinding.error} />}
            </form>
          )}
      </section>

      <section aria-labelledby="messages-heading">
        <h2 id="messages-heading">Messages</h2>
        {messages.isPending && <p role="status">Loading messages…</p>}
        {messages.data?.data.length === 0 && <p className="message-thread-empty">No messages yet.</p>}
        {messages.data?.data.map((item, index) => <p key={String(item.id ?? index)}>{String(item.body ?? '')}</p>)}
        <form className="message-composer" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="message-input" className="visually-hidden">Message</label>
          <textarea id="message-input" rows={2} value={message} onChange={(event) => setMessage(event.target.value)} disabled={sendMessage.isPending} placeholder="Message your mechanic" />
          <button type="button" disabled={!message.trim() || sendMessage.isPending} onClick={() => sendMessage.mutate()}>Send</button>
        </form>
        {sendMessage.isError && <ErrorPanel error={sendMessage.error} onRetry={() => sendMessage.mutate()} />}
      </section>

      {actorKey === 'mechanic' && (
        <section aria-labelledby="mechanic-controls-heading">
          <h2 id="mechanic-controls-heading">Mechanic controls</h2>

          <form
            className="intake-step"
            onSubmit={(event) => {
              event.preventDefault();
              transitionJob.mutate();
            }}
          >
            {/* The contract's JobTransition.status is a free string with no enum (openapi.yaml)
                — there is no fixed list of valid next statuses to offer, so this is a plain
                text field rather than a dropdown with guessed options. */}
            <label>
              Update status
              <input value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} placeholder="e.g. in_progress" />
            </label>
            <button type="submit" disabled={!nextStatus.trim() || transitionJob.isPending}>
              {transitionJob.isPending ? 'Updating…' : 'Update status'}
            </button>
            {transitionJob.isError && <ValidationErrors error={transitionJob.error} />}
            {transitionJob.isSuccess && <p role="status">Status updated to {transitionJob.data.data.status}.</p>}
          </form>

          <form
            className="intake-step"
            onSubmit={(event) => {
              event.preventDefault();
              completeJob.mutate();
            }}
          >
            <label>
              Completion summary
              <textarea rows={3} value={completionSummary} onChange={(event) => setCompletionSummary(event.target.value)} placeholder="Summarize the completed work" />
            </label>
            <button type="submit" disabled={!completionSummary.trim() || completeJob.isPending}>
              {completeJob.isPending ? 'Submitting…' : 'Submit completion report'}
            </button>
            {completeJob.isError && <ErrorPanel error={completeJob.error} onRetry={() => completeJob.mutate()} />}
            {completeJob.isSuccess && <p role="status">Completion report submitted.</p>}
          </form>
        </section>
      )}

      {actorKey === 'customer' && (
        <section aria-labelledby="invoices-heading">
          <h2 id="invoices-heading">Invoices</h2>
          {invoices.isPending && <p role="status">Loading invoices&hellip;</p>}
          {invoices.isError && <ErrorPanel error={invoices.error} onRetry={() => invoices.refetch()} />}
          {invoices.data && (
            (() => {
              const forThisJob = invoices.data.data.filter((invoice) => invoice.jobId === id);
              if (forThisJob.length === 0) {
                return <p className="pending-note">No invoices for this job yet.</p>;
              }
              return (
                <ul className="service-list">
                  {forThisJob.map((invoice) => (
                    <li key={invoice.id} className="service-card">
                      <strong>
                        ${(invoice.totalMinor / 100).toFixed(2)} {invoice.currency} &mdash; <StatusBadge status={invoice.status} />
                      </strong>
                      {invoice.dueAt && <span>Due {new Date(invoice.dueAt).toLocaleDateString()}</span>}
                    </li>
                  ))}
                </ul>
              );
            })()
          )}
        </section>
      )}
    </section>
  );
}
