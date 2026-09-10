import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInViewOnce } from '../hooks.js';
import type { SupabaseAuthState } from '../lib/useSupabaseSession.js';
import { supabase } from '../lib/supabaseClient.js';

// Sign-in only, deliberately — see the comment in lib/supabaseClient.ts and
// docs/change-requests/CR-007.md for why self-serve sign-up isn't built here: a brand-new
// Supabase Auth account has no `memberships` row yet, so it would 403 on every real request.
export function SignIn({ auth }: { auth: SupabaseAuthState }) {
  const navigate = useNavigate();
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await auth.signIn(email.trim(), password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate('/');
  };

  return (
    <section aria-labelledby="sign-in-heading">
      <h1
        id="sign-in-heading"
        ref={headingRef}
        className={`page-heading${headingInView ? ' is-in-view' : ''}`}
      >
        Sign in
      </h1>

      {!supabase && (
        <p className="pending-note">
          Real sign-in isn&rsquo;t configured for this environment (no VITE_SUPABASE_URL/
          VITE_SUPABASE_ANON_KEY) &mdash; use the development session switcher above instead.
        </p>
      )}

      {supabase && (
        <form className="intake-step" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" disabled={!email.trim() || !password || isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
          {error && (
            <p role="alert" className="field-errors">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
