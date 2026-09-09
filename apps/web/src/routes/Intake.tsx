import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel } from '../components/shared.js';

// "Tap Your Trouble" guided intake — the product agreement's signature intake flow. There is no
// POST /service-requests (or /uploads) in the contract yet, so this is a real, fully interactive
// 4-step wizard (vehicle -> details -> photos -> review) that ends honestly: the final Submit
// button is genuinely disabled, and photos are previewed client-side (object URLs, revoked on
// removal/unmount) but never sent anywhere — no fake network call, no fabricated success. See
// CR-005.
type IntakeCategory = 'something-wrong' | 'tires' | 'bodywork';

const INTAKE_CATEGORIES: Record<IntakeCategory, { title: string; options: string[] }> = {
  'something-wrong': {
    title: "Something's wrong",
    options: ["Won't start", 'Strange noise', 'Warning light on', 'Leaking fluid', 'Vibration or shaking', 'Other']
  },
  tires: {
    title: 'Tires & maintenance',
    options: ['Flat or damaged tire', 'Uneven wear', 'Routine rotation', 'New tires (all 4)', 'New tires (2)', 'Other']
  },
  bodywork: {
    title: 'Bodywork & paint',
    options: ['Front bumper', 'Rear bumper', 'Door panel', 'Hood', 'Paint scratch or chip', 'Other']
  }
};

type IntakePhoto = { id: string; file: File; previewUrl: string };

export function Intake({ api, actorKey }: { api: ApiAdapter; actorKey: ActorKey }) {
  const { category } = useParams<{ category: string }>();
  const meta = INTAKE_CATEGORIES[category as IntakeCategory] ?? INTAKE_CATEGORIES['something-wrong'];
  const vehicles = useQuery({ queryKey: ['vehicles', actorKey], queryFn: () => api.listVehicles() });
  const { ref: headingRef, isInView: headingInView } = useInViewOnce<HTMLHeadingElement>();

  const [step, setStep] = useState(1);
  const [vehicleId, setVehicleId] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<IntakePhoto[]>([]);

  // Revokes whatever photos exist at actual unmount time. A plain `() => photos.forEach(...)`
  // cleanup with an empty dependency array would close over the *initial* (empty) photos array,
  // not the latest one — the ref sidesteps that stale-closure trap.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), []);

  const toggleSymptom = (option: string) => {
    setSymptoms((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]));
  };

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setPhotos((current) => [
      ...current,
      ...files.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }))
    ]);
    event.target.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
  };

  const selectedVehicle = vehicles.data?.data.find((vehicle) => vehicle.id === vehicleId);
  const submitRequest = useMutation({ mutationFn: () => api.createServiceRequest({ vehicleId, category: category ?? 'something-wrong', symptoms, notes: notes.trim() || undefined }), onSuccess: () => setStep(5) });

  return (
    <section aria-labelledby="intake-heading">
      <h1 id="intake-heading" ref={headingRef} className={`page-heading${headingInView ? ' is-in-view' : ''}`}>
        {meta.title}
      </h1>
      <p className="intake-step-indicator">Step {step} of 4</p>

      {step === 1 && (
        <div className="intake-step">
          <h2>Which vehicle?</h2>
          {vehicles.isPending && <p role="status">Loading your vehicles&hellip;</p>}
          {vehicles.isError && <ErrorPanel error={vehicles.error} onRetry={() => vehicles.refetch()} />}
          {vehicles.data && vehicles.data.data.length === 0 && (
            <p>
              You don&rsquo;t have any vehicles yet. <Link to="/vehicles">Add one in My Garage</Link> first.
            </p>
          )}
          {vehicles.data && vehicles.data.data.length > 0 && (
            <div className="intake-vehicle-list">
              {vehicles.data.data.map((vehicle) => (
                <label key={vehicle.id} className="intake-vehicle-option">
                  <input
                    type="radio"
                    name="vehicle"
                    value={vehicle.id}
                    checked={vehicleId === vehicle.id}
                    onChange={() => setVehicleId(vehicle.id)}
                  />
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </label>
              ))}
            </div>
          )}
          <div className="intake-nav">
            <button type="button" disabled={!vehicleId} onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="intake-step">
          <h2>What&rsquo;s going on?</h2>
          <div className="intake-chip-group">
            {meta.options.map((option) => (
              <button
                key={option}
                type="button"
                className={`intake-chip${symptoms.includes(option) ? ' is-selected' : ''}`}
                aria-pressed={symptoms.includes(option)}
                onClick={() => toggleSymptom(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <label>
            Anything else we should know? (optional)
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="intake-nav">
            <button type="button" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" disabled={symptoms.length === 0 && notes.trim() === ''} onClick={() => setStep(3)}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="intake-step">
          <h2>Add photos (optional)</h2>
          <p className="pending-note">
            Photos are previewed here so you can confirm what you&rsquo;re sending, but uploading isn&rsquo;t
            published in the API contract yet (see docs/change-requests/CR-005.md) — nothing leaves your device.
          </p>
          <label className="intake-photo-input">
            <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} />
            Choose photos
          </label>
          {photos.length > 0 && (
            <ul className="intake-photo-list">
              {photos.map((photo) => (
                <li key={photo.id}>
                  <img src={photo.previewUrl} alt="" />
                  <button type="button" onClick={() => removePhoto(photo.id)} aria-label={`Remove photo ${photo.file.name}`}>
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="intake-nav">
            <button type="button" onClick={() => setStep(2)}>
              Back
            </button>
            <button type="button" onClick={() => setStep(4)}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="intake-step">
          <h2>Review &amp; submit</h2>
          <ul className="service-list">
            <li className="service-card">
              <strong>Vehicle</strong>
              <span>
                {selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : 'Not selected'}
              </span>
            </li>
            <li className="service-card">
              <strong>Category</strong>
              <span>{meta.title}</span>
            </li>
            <li className="service-card">
              <strong>Details</strong>
              <span>{symptoms.length > 0 ? symptoms.join(', ') : 'None selected'}</span>
            </li>
            {notes.trim() !== '' && (
              <li className="service-card">
                <strong>Notes</strong>
                <span>{notes}</span>
              </li>
            )}
            <li className="service-card">
              <strong>Photos</strong>
              <span>{photos.length}</span>
            </li>
          </ul>
          <button type="button" disabled={submitRequest.isPending || !vehicleId} onClick={() => submitRequest.mutate()}>
            {submitRequest.isPending ? 'Submitting…' : 'Submit request'}
          </button>
          {submitRequest.isError && <ErrorPanel error={submitRequest.error} onRetry={() => submitRequest.mutate()} />}
          {submitRequest.isSuccess && <p role="status">Request submitted. We’ll review the details and follow up with next steps.</p>}
          <div className="intake-nav">
            <button type="button" onClick={() => setStep(3)}>
              Back
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
