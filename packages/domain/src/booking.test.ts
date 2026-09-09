import { describe, expect, it } from 'vitest';
import { canHold } from './booking.js';
describe('booking concurrency invariant', () => { it('rejects overlapping active holds for the same mechanic', () => { const existing = [{ mechanicId: 'm1', startsAt: 100, endsAt: 200, status: 'held' as const }]; expect(canHold(existing, { mechanicId: 'm1', startsAt: 150, endsAt: 250, status: 'held' }, 50)).toBe(false); expect(canHold(existing, { mechanicId: 'm2', startsAt: 150, endsAt: 250, status: 'held' }, 50)).toBe(true); }); });
