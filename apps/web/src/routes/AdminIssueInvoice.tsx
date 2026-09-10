import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import { useInViewOnce } from '../hooks.js';
import { ValidationErrors } from '../components/shared.js';

// CR-010, resolved: an admin can now create a real invoice for a job. POST /admin/jobs/{id}/invoices
// only takes {currency, totalMinor} — it derives the customer from the job itself server-side, so
// there's nothing else for the admin to enter or get wrong.
export function AdminIssueInvoice({ api }: { api: ApiAdapter }) {
  const { id } = useParams();
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');

  const issueInvoice = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('No job selected.');
      return api.createInvoiceForJob(id, { currency, totalMinor: Math.round(Number(amount) * 100) });
    },
    onSuccess: () => setAmount('')
  });

  const canSubmit = Boolean(id) && Number.isFinite(Number(amount)) && Number(amount) > 0;

  return (
    <section aria-labelledby="issue-invoice-heading">
      {id && <Link to={`/jobs/${id}`}>&larr; Back to Repair Room</Link>}
      <h1
        id="issue-invoice-heading"
        ref={headingRef}
        className={`page-heading${headingInView ? ' is-in-view' : ''}`}
      >
        Issue an invoice
      </h1>

      <form
        className="intake-step"
        onSubmit={(event) => {
          event.preventDefault();
          issueInvoice.mutate();
        }}
      >
        <label>
          Currency
          <input required value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} />
        </label>
        <label>
          Amount ({currency || 'USD'})
          <input inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="99.00" />
        </label>
        <button type="submit" disabled={!canSubmit || issueInvoice.isPending}>
          {issueInvoice.isPending ? 'Issuing…' : 'Issue invoice'}
        </button>
        {issueInvoice.isError && <ValidationErrors error={issueInvoice.error} />}
        {issueInvoice.isSuccess && (
          <p role="status">
            Invoice issued for ${(issueInvoice.data.data.totalMinor / 100).toFixed(2)} {issueInvoice.data.data.currency}. The
            customer can pay it from their Repair Room.
          </p>
        )}
      </form>
    </section>
  );
}
