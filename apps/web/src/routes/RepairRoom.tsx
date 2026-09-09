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
        <p className="pending-note">
          Findings aren&rsquo;t published in the API contract yet (<code>GET /jobs/{'{id}'}/findings</code> — see{' '}
          docs/change-requests/CR-004.md). Once available, each finding will show a photo, the mechanic&rsquo;s
          note, and a Recommended now / Plan for later / Monitor category. No findings are shown here in the
          meantime — this is a real empty state, not fabricated data standing in for the feature.
        </p>
      </section>

      <section aria-labelledby="messages-heading">
        <h2 id="messages-heading">Messages</h2>
        <p className="message-thread-empty">No messages yet.</p>
        {/* Disabled, not just visually — there is no POST /jobs/{id}/messages to send to yet.
            This previews the coming layout; it intentionally cannot submit anything. */}
        <form className="message-composer" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="message-input" className="visually-hidden">Message</label>
          <textarea id="message-input" rows={2} disabled placeholder="Messaging isn't live yet — see CR-004." />
          <button type="submit" disabled>Send</button>
        </form>
        <p className="pending-note">
          Sending and receiving messages isn&rsquo;t published in the API contract yet (
          <code>GET</code>/<code>POST /jobs/{'{id}'}/messages</code> — see docs/change-requests/CR-004.md).
        </p>
      </section>

      <p className="pending-note">
        Change orders, completion reports, and invoices are not yet published in the API contract. Those sections
        will appear here once their endpoints ship (see docs/integration-status.md).
      </p>
    </section>
  );
}
