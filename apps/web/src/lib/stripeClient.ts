// Real Stripe test-mode client. Mirrors lib/supabaseClient.ts's pattern — null when unconfigured
// is a first-class state, not a crash.
import { loadStripe, type Stripe } from '@stripe/stripe-js';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export const stripePromise: Promise<Stripe | null> | null = publishableKey ? loadStripe(publishableKey) : null;
