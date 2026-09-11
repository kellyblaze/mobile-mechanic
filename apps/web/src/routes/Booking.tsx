import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel } from '../components/shared.js';

const HOLD_DURATION_MS = 60 * 60 * 1000;
const HOLD_EXPIRES_IN_MS = 30 * 60 * 1000;

export function Booking({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();
  // CR-013, resolved: GET /mechanics now scopes to the caller's own business and returns DISTINCT
  // rows — re-verified live (was returning the same mechanic four times before the fix).
  // Found in a later cleanup pass: the query key omitted actorKey even though the response is
  // business-scoped per caller (bookingRepository.listMechanics(a.id) server-side) — the exact
  // same stale-cross-actor-cache defect already found and fixed in the Monitoring screens.
  const mechanics = useQuery({ queryKey: ['mechanics', actorKey], queryFn: () => api.listMechanics() });

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

  // Cancellation needs the real appointment id, which only exists once confirmHold succeeds —
  // there's no GET endpoint anywhere in the app that surfaces an appointment's id afterward (a
  // job's own GET response omits appointmentId even though the DB has it — see CR-015), so this
  // is the only place in the app a cancel action is currently possible at all.
  const [cancelReason, setCancelReason] = useState('');
  const cancelAppointment = useMutation({
    mutationFn: () => {
      if (!confirmHold.data) throw new Error('Nothing to cancel yet.');
      return api.cancelAppointment(confirmHold.data.data.appointment.id, cancelReason.trim() || undefined);
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
      {mechanics.data && mechanics.data.data.length === 0 && <p className="pending-note">No mechanics are available to book right now.</p>}

      {mechanics.data && mechanics.data.data.length > 0 && (
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
                cancelAppointment.reset();
                setCancelReason('');
              }}
            >
              <option value="">Select a mechanic&hellip;</option>
              {mechanics.data.data.map((mechanic) => (
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
                cancelAppointment.reset();
                setCancelReason('');
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
      {confirmHold.isSuccess && !cancelAppointment.isSuccess && (
        <div>
          <p role="status">
            Booking confirmed for {new Date(confirmHold.data.data.appointment.startsAt).toLocaleString()}.
          </p>
          <form
            className="intake-step"
            onSubmit={(event) => {
              event.preventDefault();
              cancelAppointment.mutate();
            }}
          >
            <label>
              Reason (optional)
              <input
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="e.g. schedule conflict"
                disabled={cancelAppointment.isPending}
              />
            </label>
            {/* Customers/mechanics need at least two hours notice — a cancellation inside that
                window returns a real 409 CANCELLATION_CUTOFF, shown below via the real server
                message rather than a guessed one. */}
            <button type="submit" disabled={cancelAppointment.isPending}>
              {cancelAppointment.isPending ? 'Cancelling…' : 'Cancel this booking'}
            </button>
          </form>
          {cancelAppointment.isError && <ErrorPanel error={cancelAppointment.error} onRetry={() => cancelAppointment.mutate()} />}
        </div>
      )}
      {cancelAppointment.isSuccess && <p role="status">Booking cancelled.</p>}
    </section>
  );
}
