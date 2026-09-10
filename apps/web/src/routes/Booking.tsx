import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel } from '../components/shared.js';

const HOLD_DURATION_MS = 60 * 60 * 1000;
const HOLD_EXPIRES_IN_MS = 30 * 60 * 1000;

export function Booking({ api }: { api: ApiAdapter }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const mechanics = useQuery({ queryKey: ['mechanics'], queryFn: () => api.listMechanics() });
  // CR-013: GET /mechanics currently returns duplicate rows (confirmed live via curl — the same
  // mechanic came back four times) — deduplicated by id here so the picker doesn't show repeats,
  // even though the underlying cross-tenant scoping gap isn't something the frontend can fix.
  const uniqueMechanics = mechanics.data
    ? Array.from(new Map(mechanics.data.data.map((mechanic) => [mechanic.id, mechanic])).values())
    : [];

  const [mechanicId, setMechanicId] = useState('');
  const [startLocal, setStartLocal] = useState('');

  const startsAtIso = startLocal ? new Date(startLocal).toISOString() : null;
  const endsAtIso = startsAtIso ? new Date(new Date(startsAtIso).getTime() + HOLD_DURATION_MS).toISOString() : null;

  const checkAvailability = useMutation({
    mutationFn: () => {
      if (!mechanicId || !startsAtIso || !endsAtIso) throw new Error('Pick a mechanic and start time first.');
      return api.checkAvailability({ mechanicId, startsAt: startsAtIso, endsAt: endsAtIso });
    }
  });

  const createHold = useMutation({
    mutationFn: () => {
      if (!mechanicId || !startsAtIso || !endsAtIso) throw new Error('Pick a mechanic and start time first.');
      return api.createBookingHold({
        mechanicId,
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        expiresAt: new Date(Date.now() + HOLD_EXPIRES_IN_MS).toISOString(),
        idempotencyKey: crypto.randomUUID()
      });
    }
  });

  const confirmHold = useMutation({
    mutationFn: () => {
      if (!createHold.data) throw new Error('Hold a slot first.');
      return api.confirmBookingHold(createHold.data.data.id);
    }
  });

  return (
    <section aria-labelledby="booking-heading">
      <h1
        id="booking-heading"
        ref={headingRef}
        className={`page-heading${headingInView ? ' is-in-view' : ''}`}
      >
        Book a mechanic
      </h1>

      {mechanics.isPending && <p role="status">Loading mechanics&hellip;</p>}
      {mechanics.isError && <ErrorPanel error={mechanics.error} onRetry={() => mechanics.refetch()} />}
      {mechanics.data && uniqueMechanics.length === 0 && <p className="pending-note">No mechanics are available to book right now.</p>}

      {uniqueMechanics.length > 0 && (
        <form
          className="intake-step"
          onSubmit={(event) => {
            event.preventDefault();
            checkAvailability.mutate();
          }}
        >
          <label>
            Mechanic
            <select
              required
              value={mechanicId}
              onChange={(event) => {
                setMechanicId(event.target.value);
                checkAvailability.reset();
                createHold.reset();
                confirmHold.reset();
              }}
            >
              <option value="">Select a mechanic&hellip;</option>
              {uniqueMechanics.map((mechanic) => (
                <option key={mechanic.id} value={mechanic.id}>
                  {mechanic.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start time (1 hour)
            <input
              type="datetime-local"
              required
              value={startLocal}
              onChange={(event) => {
                setStartLocal(event.target.value);
                checkAvailability.reset();
                createHold.reset();
                confirmHold.reset();
              }}
            />
          </label>
          <button type="submit" disabled={!mechanicId || !startLocal || checkAvailability.isPending}>
            {checkAvailability.isPending ? 'Checking…' : 'Check availability'}
          </button>
          {checkAvailability.isError && <ErrorPanel error={checkAvailability.error} onRetry={() => checkAvailability.mutate()} />}
        </form>
      )}

      {checkAvailability.isSuccess && (
        <p role="status">
          {checkAvailability.data.available
            ? 'This time is available.'
            : 'This time conflicts with an existing appointment or hold — pick another.'}
        </p>
      )}

      {checkAvailability.isSuccess && checkAvailability.data.available && !createHold.isSuccess && (
        <button onClick={() => createHold.mutate()} disabled={createHold.isPending}>
          {createHold.isPending ? 'Holding…' : 'Hold this slot'}
        </button>
      )}
      {createHold.isError && <ErrorPanel error={createHold.error} onRetry={() => createHold.mutate()} />}
      {createHold.isSuccess && !confirmHold.isSuccess && (
        <div>
          <p role="status">Slot held until {new Date(createHold.data.data.expiresAt).toLocaleString()}.</p>
          <button onClick={() => confirmHold.mutate()} disabled={confirmHold.isPending}>
            {confirmHold.isPending ? 'Confirming…' : 'Confirm booking'}
          </button>
        </div>
      )}
      {confirmHold.isError && <ErrorPanel error={confirmHold.error} onRetry={() => confirmHold.mutate()} />}
      {confirmHold.isSuccess && (
        <p role="status">
          Booking confirmed for {new Date(confirmHold.data.data.appointment.startsAt).toLocaleString()}.
        </p>
      )}
    </section>
  );
}
