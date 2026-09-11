import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import type { ActorKey } from '../lib/devActors.js';
import { useInViewOnce } from '../hooks.js';
import { ErrorPanel } from '../components/shared.js';

// "Tap Your Trouble" guided intake — the product agreement's signature intake flow. A real,
// fully interactive 4-step wizard (vehicle -> details -> photos -> review) backed by the real
// POST /service-requests (CR-005) and, as of 2026-09-11, real photo uploads (CR-005/CR-017):
// each selected photo is genuinely uploaded to a private Supabase Storage bucket the moment it's
// added (initiate -> PUT the real bytes -> complete — see apiAdapter.ts's uploadFileToSignedUrl).
// What's still missing: POST /service-requests accepts an `attachmentIds` field but the backend
// silently discards it — uploaded photos aren't yet linked to the request a mechanic can see.
// Sent anyway (harmless, forward-compatible), and disclosed honestly in the photo step's copy.
// See docs/change-requests/CR-017.md.
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

// The real POST /uploads schema only accepts these three image types (plus video/mp4, not
// relevant to a photo picker) — confirmed live via curl (a text/plain attempt 422'd with this
// exact enum in the field error). Checked client-side too so a rejected file (e.g. an iPhone's
// native HEIC) gets an immediate, specific message instead of a failed network round trip.
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type UploadStatus = 'uploading' | 'uploaded' | 'error';
type IntakePhoto = {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  uploadId?: string;
  errorMessage?: string;
};

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

  // Uploads the real file the moment it's added — initiate, PUT the bytes to the signed URL,
  // then mark it ready. If the photo was already removed from state by the time this settles
  // (the user clicked the × mid-upload), the functional update below simply finds no matching id
  // and does nothing — no crash, no orphaned UI update.
  const uploadPhoto = async (photo: IntakePhoto) => {
    try {
      const initiated = await api.initiateUpload({ fileName: photo.file.name, contentType: photo.file.type, sizeBytes: photo.file.size });
      if (!initiated.data.uploadUrl) throw new Error('Storage did not return an upload URL.');
      await api.uploadFileToSignedUrl(initiated.data.uploadUrl, photo.file);
      await api.completeUpload(initiated.data.id);
      setPhotos((current) => current.map((item) => (item.id === photo.id ? { ...item, status: 'uploaded', uploadId: initiated.data.id } : item)));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed — try again.';
      setPhotos((current) => current.map((item) => (item.id === photo.id ? { ...item, status: 'error', errorMessage: message } : item)));
    }
  };

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const newPhotos: IntakePhoto[] = files.map((file) => {
      const isAllowedType = ALLOWED_PHOTO_TYPES.has(file.type);
      return {
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: isAllowedType ? 'uploading' : 'error',
        errorMessage: isAllowedType ? undefined : `${file.type || 'This file type'} isn't supported — use JPEG, PNG, or WebP.`
      };
    });
    setPhotos((current) => [...current, ...newPhotos]);
    event.target.value = '';
    for (const photo of newPhotos) {
      if (photo.status === 'uploading') void uploadPhoto(photo);
    }
  };

  const retryPhoto = (id: string) => {
    const photo = photos.find((item) => item.id === id);
    if (!photo) return;
    setPhotos((current) => current.map((item) => (item.id === id ? { ...item, status: 'uploading', errorMessage: undefined } : item)));
    void uploadPhoto({ ...photo, status: 'uploading' });
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
  };

  const selectedVehicle = vehicles.data?.data.find((vehicle) => vehicle.id === vehicleId);
  const uploadedPhotoCount = photos.filter((photo) => photo.status === 'uploaded').length;
  const isAnyPhotoUploading = photos.some((photo) => photo.status === 'uploading');
  const submitRequest = useMutation({
    mutationFn: () =>
      api.createServiceRequest({
        vehicleId,
        category: category ?? 'something-wrong',
        symptoms,
        notes: notes.trim() || undefined,
        attachmentIds: photos.filter((photo) => photo.status === 'uploaded' && photo.uploadId).map((photo) => photo.uploadId as string)
      }),
    onSuccess: () => setStep(5)
  });

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
            Photos upload to private storage as soon as you add them. They aren&rsquo;t visible to your
            mechanic within this request yet — see docs/change-requests/CR-017.md.
          </p>
          <label className="intake-photo-input">
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotoSelect} />
            Choose photos
          </label>
          {photos.length > 0 && (
            <ul className="intake-photo-list">
              {photos.map((photo) => (
                <li key={photo.id}>
                  <img src={photo.previewUrl} alt="" />
                  {photo.status === 'uploading' && <span role="status">Uploading&hellip;</span>}
                  {photo.status === 'uploaded' && <span className="pending-note">Uploaded</span>}
                  {photo.status === 'error' && (
                    <>
                      <span role="alert">{photo.errorMessage}</span>
                      <button type="button" onClick={() => retryPhoto(photo.id)}>
                        Retry
                      </button>
                    </>
                  )}
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
            <button type="button" disabled={isAnyPhotoUploading} onClick={() => setStep(4)}>
              {isAnyPhotoUploading ? 'Uploading photos…' : 'Next'}
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
              <span>
                {photos.length === 0
                  ? 0
                  : `${uploadedPhotoCount} of ${photos.length} uploaded${photos.length > uploadedPhotoCount ? ' (the rest failed and won’t be included)' : ''}`}
              </span>
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
