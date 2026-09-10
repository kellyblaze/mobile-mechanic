import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel } from '../components/shared.js';

// There is no endpoint to list mechanics (CR-011 filed) — grepped every route in
// apps/api/src/server.ts, only booking against a known mechanicId is possible. This is the one
// seeded mechanic's real id (found via GET /session with the mechanic-demo dev header), the same
// honest-default pattern RepairRoom.tsx already uses for the seeded job id.
const KNOWN_MECHANIC_ID = 'cdc32033-2496-4870-8995-f2ca695bbeb9';
const HOLD_DURATION_MS = 60 * 60 * 1000;
const HOLD_EXPIRES_IN_MS = 30 * 60 * 1000;

export function Booking({ api }: { api: ApiAdapter }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  const [startLocal, setStartLocal] = useState('');

  const startsAtIso = startLocal ? new Date(startLocal).toISOString() : null;
  const endsAtIso = startsAtIso ? new Date(new Date(startsAtIso).getTime() + HOLD_DURATION_MS).toISOString() : null;

  const checkAvailability = useMutation({
    mutationFn: () => {
      if (!startsAtIso || !endsAtIso) throw new Error('Pick a start time first.');
      return api.checkAvailability({ mechanicId: KNOWN_MECHANIC_ID, startsAt: startsAtIso, endsAt: endsAtIso });
    }
  });

  const createHold = useMutation({
    mutationFn: () => {
      if (!startsAtIso || !endsAtIso) throw new Error('Pick a start time first.');
      return api.createBookingHold({
        mechanicId: KNOWN_MECHANIC_ID,
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        expiresAt: new Date(Date.now() + HOLD_EXPIRES_IN_MS).toISOString(),
        idempotencyKey: crypto.randomUUID()
      });
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

      <p className="pending-note">
        There&rsquo;s no way yet to pick which mechanic you&rsquo;re booking &mdash; this checks
        against the one mechanic currently on staff (CR-011). Holding a slot also doesn&rsquo;t
        confirm an appointment yet &mdash; the shop still needs to follow up to finalize it
        (CR-012).
      </p>

      <form
        className="intake-step"
        onSubmit={(event) => {
          event.preventDefault();
          checkAvailability.mutate();
        }}
      >
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
            }}
          />
        </label>
        <button type="submit" disabled={!startLocal || checkAvailability.isPending}>
          {checkAvailability.isPending ? 'Checking…' : 'Check availability'}
        </button>
        {checkAvailability.isError && <ErrorPanel error={checkAvailability.error} onRetry={() => checkAvailability.mutate()} />}
      </form>

      {checkAvailability.isSuccess && (
        <p role="status">
          {checkAvailability.data.available
            ? 'This time is available.'
            : 'This time conflicts with an existing appointment — pick another.'}
        </p>
      )}

      {checkAvailability.isSuccess && checkAvailability.data.available && !createHold.isSuccess && (
        <button onClick={() => createHold.mutate()} disabled={createHold.isPending}>
          {createHold.isPending ? 'Holding…' : 'Hold this slot'}
        </button>
      )}
      {createHold.isError && <ErrorPanel error={createHold.error} onRetry={() => createHold.mutate()} />}
      {createHold.isSuccess && (
        <p role="status">
          Slot held until {new Date(createHold.data.data.expiresAt).toLocaleString()}. The shop
          will follow up to confirm your appointment.
        </p>
      )}
    </section>
  );
}
