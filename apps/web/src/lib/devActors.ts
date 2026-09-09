import type { DevActor } from './apiAdapter.js';

export const DEV_ACTORS = {
  customer: { userId: 'customer-demo', role: 'customer' },
  mechanic: { userId: 'mechanic-demo', role: 'mechanic' },
  admin: { userId: 'admin-demo', role: 'admin' }
} satisfies Record<string, DevActor>;

export type ActorKey = keyof typeof DEV_ACTORS;
