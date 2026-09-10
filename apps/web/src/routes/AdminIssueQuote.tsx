import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel } from '../components/shared.js';

type QuoteLine = { id: string; description: string; amount: string };

// Service requests awaiting a quote, via CR-006 (resolved in contract 1.4.0). customerId comes
// straight off the selected request — no more manual UUID entry for either field.
export function AdminIssueQuote({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const serviceRequests = useQuery({
    queryKey: ['admin-service-requests', 'submitted', actorKey],
    queryFn: () => api.listAdminServiceRequests('submitted')
  });
  const [requestId, setRequestId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [lines, setLines] = useState<QuoteLine[]>([{ id: crypto.randomUUID(), description: '', amount: '' }]);

  const selectedRequest = serviceRequests.data?.data.find((request) => request.id === requestId);

  const addLine = () => setLines((current) => [...current, { id: crypto.randomUUID(), description: '', amount: '' }]);
  const removeLine = (id: string) => setLines((current) => current.filter((line) => line.id !== id));
  const updateLine = (id: string, field: 'description' | 'amount', value: string) =>
    setLines((current) => current.map((line) => (line.id === id ? { ...line, [field]: value } : line)));

  // A line only counts once both fields are genuinely usable — previously the amount side wasn't
  // checked here, so a line with a real description but a non-numeric amount (e.g. "abc") silently
  // submitted as amountMinor: null (Math.round(NaN * 100) is NaN, which JSON.stringify drops to
  // null) instead of being excluded or flagged.
  const isUsableLine = (line: QuoteLine) => line.description.trim() !== '' && Number.isFinite(Number(line.amount)) && Number(line.amount) > 0;
  const droppableLines = lines.filter((line) => line.description.trim() !== '' && !isUsableLine(line));

  const issueQuote = useMutation({
    mutationFn: () => {
      if (!selectedRequest) throw new Error('Select a service request first.');
      return api.issueQuote(selectedRequest.id, {
        customerId: selectedRequest.customerId,
        currency,
        lines: lines.filter(isUsableLine).map((line) => ({ description: line.description.trim(), amountMinor: Math.round(Number(line.amount) * 100) }))
      });
    },
    onSuccess: () => {
      setRequestId('');
      setCurrency('USD');
      setLines([{ id: crypto.randomUUID(), description: '', amount: '' }]);
      void serviceRequests.refetch();
    }
  });

  const canSubmit = Boolean(selectedRequest) && lines.some(isUsableLine);

  return (
    <section aria-labelledby="issue-quote-heading">
      <Link to="/admin/jobs">&larr; Back to Jobs</Link>
      <h1
        id="issue-quote-heading"
        ref={headingRef}
        className={`page-heading${headingInView ? ' is-in-view' : ''}`}
      >
        Issue a quote
      </h1>

      {serviceRequests.isPending && <p role="status">Loading service requests&hellip;</p>}
      {serviceRequests.isError && <ErrorPanel error={serviceRequests.error} onRetry={() => serviceRequests.refetch()} />}
      {serviceRequests.data && serviceRequests.data.data.length === 0 && (
        <p className="pending-note">No service requests are awaiting a quote right now.</p>
      )}
      {serviceRequests.data && serviceRequests.data.data.length > 0 && (
        <p className="pending-note">
          Issuing a quote here doesn&rsquo;t change a request&rsquo;s status yet (CR-008), so an
          already-quoted request may still show up below &mdash; check the customer&rsquo;s Repair
          Room before issuing a second one.
        </p>
      )}

      {serviceRequests.data && serviceRequests.data.data.length > 0 && (
        <form
          className="intake-step"
          onSubmit={(event) => {
            event.preventDefault();
            issueQuote.mutate();
          }}
        >
          <label>
            Service request
            <select required value={requestId} onChange={(event) => setRequestId(event.target.value)}>
              <option value="">Select a service request&hellip;</option>
              {serviceRequests.data.data.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.customerEmail} &mdash; {request.year} {request.make} {request.model} ({request.category})
                </option>
              ))}
            </select>
          </label>
          {selectedRequest && (
            <p className="pending-note">
              {selectedRequest.symptoms.length > 0 && <>Symptoms: {selectedRequest.symptoms.join(', ')}. </>}
              {selectedRequest.notes && <>Notes: {selectedRequest.notes}. </>}
              Delivery: {selectedRequest.deliveryMode}. Submitted {new Date(selectedRequest.createdAt).toLocaleDateString()}.
            </p>
          )}
          <label>
            Currency
            <input required value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} />
          </label>

          <div className="intake-vehicle-list">
            {lines.map((line) => (
              <div key={line.id} className="quote-line">
                <label>
                  Description
                  <input
                    value={line.description}
                    onChange={(event) => updateLine(line.id, 'description', event.target.value)}
                    placeholder="e.g. Diagnostic appointment"
                  />
                </label>
                <label>
                  Amount (USD)
                  <input
                    inputMode="decimal"
                    value={line.amount}
                    onChange={(event) => updateLine(line.id, 'amount', event.target.value)}
                    placeholder="99.00"
                  />
                </label>
                {lines.length > 1 && (
                  <button type="button" onClick={() => removeLine(line.id)} aria-label="Remove line">
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          {droppableLines.length > 0 && (
            <p role="alert" className="field-errors">
              {droppableLines.length === 1
                ? 'One line has a description but no valid amount and will be left out of the quote.'
                : `${droppableLines.length} lines have a description but no valid amount and will be left out of the quote.`}
            </p>
          )}
          <div className="intake-nav">
            <button type="button" onClick={addLine}>
              Add line
            </button>
            <button type="submit" disabled={!canSubmit || issueQuote.isPending}>
              {issueQuote.isPending ? 'Issuing…' : 'Issue quote'}
            </button>
          </div>
          {issueQuote.isError && <ErrorPanel error={issueQuote.error} onRetry={() => issueQuote.mutate()} />}
          {issueQuote.isSuccess && <p role="status">Quote issued. The customer can review and approve it in their Repair Room.</p>}
        </form>
      )}
    </section>
  );
}
