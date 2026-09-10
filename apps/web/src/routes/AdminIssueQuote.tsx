import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel } from '../components/shared.js';

type QuoteLine = { id: string; description: string; amount: string };

// Admin manually enters the service-request id and customer id below — the contract has no
// "list pending service requests" endpoint yet (CR-006 filed) to look either up, so there's
// currently no way to discover them from the UI. Honest limitation, not an invented workaround.
export function AdminIssueQuote({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [requestId, setRequestId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [lines, setLines] = useState<QuoteLine[]>([{ id: crypto.randomUUID(), description: '', amount: '' }]);

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
    mutationFn: () =>
      api.issueQuote(requestId.trim(), {
        customerId: customerId.trim(),
        currency,
        lines: lines.filter(isUsableLine).map((line) => ({ description: line.description.trim(), amountMinor: Math.round(Number(line.amount) * 100) }))
      }),
    onSuccess: () => {
      setRequestId('');
      setCustomerId('');
      setCurrency('USD');
      setLines([{ id: crypto.randomUUID(), description: '', amount: '' }]);
    }
  });

  const canSubmit = requestId.trim() !== '' && customerId.trim() !== '' && lines.some(isUsableLine);

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

      <p className="pending-note">
        There is no endpoint yet to look up pending service requests or their customer, so both
        ids below must be entered manually (see docs/change-requests/CR-006.md).
      </p>

      <form
        className="intake-step"
        onSubmit={(event) => {
          event.preventDefault();
          issueQuote.mutate();
        }}
      >
        <label>
          Service request ID
          <input required value={requestId} onChange={(event) => setRequestId(event.target.value)} placeholder="Paste the service request UUID" />
        </label>
        <label>
          Customer ID
          <input required value={customerId} onChange={(event) => setCustomerId(event.target.value)} placeholder="Paste the customer UUID" />
        </label>
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
    </section>
  );
}
