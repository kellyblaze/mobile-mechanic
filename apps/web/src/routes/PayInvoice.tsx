import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { stripePromise } from '../lib/stripeClient.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel } from '../components/shared.js';

// The actual Stripe confirm step — split out because useStripe()/useElements() only resolve
// real values once inside an <Elements> provider that already has a clientSecret, which this
// component's parent doesn't have until the PaymentIntent exists.
function ConfirmPaymentForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setIsConfirming(true);
    // redirect: 'if_required' keeps this a single-page flow for payment methods that don't need
    // an off-site step (e.g. a test card) — only redirects when the method genuinely requires it.
    const result = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    setIsConfirming(false);
    if (result.error) {
      setError(result.error.message ?? 'Payment failed.');
      return;
    }
    setSucceeded(true);
    onDone();
  };

  if (succeeded) {
    return (
      <div role="status">
        <p>Payment submitted successfully.</p>
        <p className="pending-note">
          The invoice updates to paid once Stripe confirms the charge (a webhook event, not
          instant) &mdash; it may take a moment to reflect here.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit" disabled={!stripe || isConfirming} style={{ marginTop: 'var(--space-3)' }}>
        {isConfirming ? 'Confirming…' : 'Confirm payment'}
      </button>
      {error && (
        <p role="alert" className="field-errors">
          {error}
        </p>
      )}
    </form>
  );
}

export function PayInvoice({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { id } = useParams();
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const invoices = useQuery({ queryKey: ['invoices', actorKey], queryFn: () => api.listInvoices() });
  const invoice = invoices.data?.data.find((candidate) => candidate.id === id);

  const startPayment = useMutation({
    mutationFn: () => {
      if (!invoice) throw new Error('Invoice not loaded.');
      // Number(...): live-verified the real API returns totalMinor as a JSON string (e.g. "12000"),
      // despite the Invoice type declaring it a number — division/display coerce it fine, but
      // JSON.stringify does not, so sending it unconverted produced a real 422 from the server's
      // z.number() check on amountMinor. Confirmed by reproducing this exact failure live.
      return api.createPayment({ invoiceId: invoice.id, amountMinor: Number(invoice.totalMinor), currency: invoice.currency, idempotencyKey: crypto.randomUUID() });
    }
  });

  if (invoices.isPending) return <p role="status">Loading invoice&hellip;</p>;
  if (invoices.isError) return <ErrorPanel error={invoices.error} onRetry={() => invoices.refetch()} />;

  if (!invoice) {
    return (
      <section aria-labelledby="pay-invoice-heading">
        <h1 id="pay-invoice-heading" className="page-heading is-in-view">
          Invoice not found
        </h1>
        <p>This invoice isn&rsquo;t in your account, or you don&rsquo;t have access to it.</p>
      </section>
    );
  }

  if (!stripePromise) {
    return (
      <section aria-labelledby="pay-invoice-heading">
        <h1 id="pay-invoice-heading" className="page-heading is-in-view">
          Pay invoice
        </h1>
        <p className="pending-note">
          Real payments aren&rsquo;t configured for this environment (no
          VITE_STRIPE_PUBLISHABLE_KEY).
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="pay-invoice-heading">
      {invoice.jobId && <Link to={`/jobs/${invoice.jobId}`}>&larr; Back to Repair Room</Link>}
      <h1
        id="pay-invoice-heading"
        ref={headingRef}
        className={`page-heading${headingInView ? ' is-in-view' : ''}`}
      >
        Pay invoice
      </h1>

      <p>
        ${(invoice.totalMinor / 100).toFixed(2)} {invoice.currency}
      </p>

      {!startPayment.data && (
        <button onClick={() => startPayment.mutate()} disabled={startPayment.isPending}>
          {startPayment.isPending ? 'Preparing payment…' : 'Start payment'}
        </button>
      )}
      {startPayment.isError && <ErrorPanel error={startPayment.error} onRetry={() => startPayment.mutate()} />}

      {startPayment.data && (
        <Elements stripe={stripePromise} options={{ clientSecret: startPayment.data.data.clientSecret }}>
          <ConfirmPaymentForm onDone={() => void invoices.refetch()} />
        </Elements>
      )}
    </section>
  );
}
