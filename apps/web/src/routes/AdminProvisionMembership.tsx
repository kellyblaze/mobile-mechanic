import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import { useInViewOnce } from '../hooks.js';
import { ValidationErrors } from '../components/shared.js';

type Role = 'customer' | 'mechanic' | 'admin';

// CR-007, resolved as "provisioned accounts": a customer/mechanic/admin creates their own
// Supabase Auth account (sign-in only — apps/web/src/routes/SignIn.tsx), then an admin links
// that account to a business role here. This screen does not create Supabase Auth accounts —
// it only grants membership to one that already exists, matching POST /admin/memberships'
// actual behavior (404 if the email hasn't signed up yet, live-verified via curl).
export function AdminProvisionMembership({ api }: { api: ApiAdapter }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('customer');

  const provisionMembership = useMutation({
    mutationFn: () => api.provisionMembership({ email: email.trim(), role }),
    onSuccess: () => {
      setEmail('');
      setRole('customer');
    }
  });

  return (
    <section aria-labelledby="provision-membership-heading">
      <Link to="/admin/jobs">&larr; Back to Jobs</Link>
      <h1
        id="provision-membership-heading"
        ref={headingRef}
        className={`page-heading${headingInView ? ' is-in-view' : ''}`}
      >
        Grant business access
      </h1>

      <p className="pending-note">
        The person must already have a real account &mdash; they&rsquo;ve signed up through the
        approved Supabase/admin process &mdash; before you can grant them a role here. An unknown
        email returns a not-found error instead of creating one.
      </p>

      <form
        className="intake-step"
        onSubmit={(event) => {
          event.preventDefault();
          provisionMembership.mutate();
        }}
      >
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="customer@example.com"
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="customer">Customer</option>
            <option value="mechanic">Mechanic</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit" disabled={!email.trim() || provisionMembership.isPending}>
          {provisionMembership.isPending ? 'Granting…' : 'Grant access'}
        </button>
        {provisionMembership.isError && <ValidationErrors error={provisionMembership.error} />}
        {provisionMembership.isSuccess && (
          <p role="status">
            {provisionMembership.data.data.email} can now sign in as {provisionMembership.data.data.role}.
          </p>
        )}
      </form>
    </section>
  );
}
