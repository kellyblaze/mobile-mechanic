import { ApiRequestError } from '../lib/apiAdapter.js';

// Decorative, purely illustrative — aria-hidden. Each icon carries its own themed hover/focus
// animation defined in styles.css (.entry-door:hover/:focus-visible .icon-*), not a generic
// fade/scale shared across all three.
export function WrenchIcon() {
  return (
    <svg
      className="entry-icon icon-wrench"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
    </svg>
  );
}

export function TireIcon() {
  return (
    <svg className="entry-icon icon-tire" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill="var(--color-accent)" />
      <line x1="12" y1="3" x2="12" y2="7.5" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="16.5" x2="12" y2="21" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="12" x2="7.5" y2="12" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
      <line x1="16.5" y1="12" x2="21" y2="12" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// A paint sprayer, not a roller — a roller isn't how a car actually gets painted. The nozzle
// emits five staggered "spray-dot" particles (see styles.css) that fan out and fade, rather than
// the gun itself moving, so it reads as spraying gold paint rather than just wobbling.
export function SprayIcon() {
  return (
    <svg className="entry-icon icon-spray" viewBox="0 0 32 24" aria-hidden="true">
      <rect x="4" y="9" width="13" height="5" rx="1.5" fill="var(--color-accent)" />
      <rect x="17" y="10.3" width="3" height="2.4" fill="var(--color-accent)" />
      <path d="M8 14 L8 21 L11.5 21 L11.5 14 Z" fill="var(--color-accent)" />
      <path d="M11.5 15 Q15 17 11.5 19" stroke="var(--color-accent)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <circle className="spray-dot spray-dot-a" cx="21" cy="9" r="1" fill="var(--color-accent)" />
      <circle className="spray-dot spray-dot-b" cx="21" cy="11.5" r="1" fill="var(--color-accent)" />
      <circle className="spray-dot spray-dot-c" cx="21" cy="14" r="1" fill="var(--color-accent)" />
      <circle className="spray-dot spray-dot-d" cx="22" cy="10.2" r="0.8" fill="var(--color-accent)" />
      <circle className="spray-dot spray-dot-e" cx="22" cy="12.8" r="0.8" fill="var(--color-accent)" />
    </svg>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{status.replace(/_/g, ' ')}</span>;
}

export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof ApiRequestError ? error.message : 'Something went wrong loading this.';
  return (
    <div role="alert" className="error-panel">
      <p>{message}</p>
      <button onClick={onRetry}>Try again</button>
    </div>
  );
}

export function ValidationErrors({ error, isQuoteApproval = false }: { error: unknown; isQuoteApproval?: boolean }) {
  if (!(error instanceof ApiRequestError)) {
    return <p role="alert">Something went wrong. Please try again.</p>;
  }
  if (error.status === 409) {
    // There is no GET /quotes/{id} yet (see docs/integration-status.md), so this checkpoint
    // can't actually fetch a fresher version to retry against — don't promise a refresh will help.
    return (
      <p role="alert">
        {error.message}
        {isQuoteApproval ? ' This quote may already be approved.' : ' Refresh to get the latest version.'}
      </p>
    );
  }
  if (error.fieldErrors) {
    return (
      <ul role="alert" className="field-errors">
        {Object.entries(error.fieldErrors).map(([field, messages]) => (
          <li key={field}>
            {field}: {messages.join(', ')}
          </li>
        ))}
      </ul>
    );
  }
  return <p role="alert">{error.message}</p>;
}
