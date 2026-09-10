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
  const [message, setMessage] = useState('');
  const sendMessage = useMutation({ mutationFn: () => api.sendMessage(id, message), onSuccess: () => { setMessage(''); void queryClient.invalidateQueries({ queryKey: ['messages', id, actorKey] }); } });
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

      <p className="pending-note">
        Change orders, completion reports, and invoices are not yet published in the API contract. Those sections
        will appear here once their endpoints ship (see docs/integration-status.md).
      </p>
    </section>
  );
}
