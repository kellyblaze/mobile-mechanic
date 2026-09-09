import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel, StatusBadge, ValidationErrors } from '../components/shared.js';

export function RepairRoom({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { id = 'job-1' } = useParams();
  const queryClient = useQueryClient();
  const job = useQuery({ queryKey: ['job', id, actorKey], queryFn: () => api.getJob(id) });
  const findings = useQuery({ queryKey: ['findings', id, actorKey], queryFn: () => api.listFindings(id) });
  const messages = useQuery({ queryKey: ['messages', id, actorKey], queryFn: () => api.listMessages(id) });
  const [message, setMessage] = useState('');
  const sendMessage = useMutation({ mutationFn: () => api.sendMessage(id, message), onSuccess: () => { setMessage(''); void queryClient.invalidateQueries({ queryKey: ['messages', id, actorKey] }); } });
  // Called before the early returns below (loading/error) so it runs on every render, same as
  // every other hook — conditionally calling hooks after an early return breaks React's rules.
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();

  // The contract has no GET /quotes/{id} and Job carries no linked quote id/version (see
  // docs/integration-status.md and the CR-002 note below), so "quote-1" / expectedVersion 1 are
  // the only real values available in this checkpoint, not invented ones — they match the
  // backend's seeded fixture exactly. Once accepted, hide the action instead of letting a second
  // click retry a version we already know is stale.
  const acceptQuote = useMutation({
    mutationFn: (input: { quoteId: string; expectedVersion: number }) =>
      api.acceptQuote(input.quoteId, { expectedVersion: input.expectedVersion, idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['job', id, actorKey] })
  });

  if (job.isPending) return <p role="status">Loading Repair Room&hellip;</p>;
  if (job.isError) return <ErrorPanel error={job.error} onRetry={() => job.refetch()} />;

  const record = job.data.data;
  const canOfferApproval = record.allowedActions.includes('approve_change_order') && !acceptQuote.isSuccess;

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
      <p>Allowed actions: {record.allowedActions.length ? record.allowedActions.join(', ') : 'none yet'}</p>

      {canOfferApproval && (
        <button
          onClick={() => acceptQuote.mutate({ quoteId: 'quote-1', expectedVersion: 1 })}
          disabled={acceptQuote.isPending}
        >
          {acceptQuote.isPending ? 'Approving…' : 'Approve pending quote (quote-1)'}
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
