export type Slot = { mechanicId: string; startsAt: number; endsAt: number; status: 'held' | 'confirmed' | 'scheduled' | 'cancelled' | 'expired' };
export function overlaps(a: Pick<Slot, 'startsAt' | 'endsAt'>, b: Pick<Slot, 'startsAt' | 'endsAt'>) { return a.startsAt < b.endsAt && b.startsAt < a.endsAt; }
export function canHold(slots: Slot[], candidate: Slot, now = Date.now()) { return !slots.some((slot) => slot.mechanicId === candidate.mechanicId && ['held', 'confirmed', 'scheduled'].includes(slot.status) && (slot.status !== 'held' || slot.endsAt > now) && overlaps(slot, candidate)); }
