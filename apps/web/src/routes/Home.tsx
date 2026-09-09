import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ApiAdapter } from '../lib/apiAdapter.js';
import { useInViewOnce, useMediaQuery, usePrefersReducedMotion } from '../hooks.js';
import { ErrorPanel, SprayIcon, TireIcon, WrenchIcon } from '../components/shared.js';

const MOBILE_VIDEO_QUERY = '(max-width: 640px)';

// One color per sentence via --hero-line-1..4 (styles.css), keyed by array index below.
const HERO_LINES = ["Tell us what's wrong.", 'See the plan.', 'Approve the price.', 'Follow the repair.'];

export function Home({ api }: { api: ApiAdapter }) {
  const catalog = useQuery({ queryKey: ['service-catalog'], queryFn: () => api.listServiceCatalog() });
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobileViewport = useMediaQuery(MOBILE_VIDEO_QUERY);
  const { ref: promiseRef, isInView: promiseInView } = useInViewOnce<HTMLHeadingElement>();

  const entryDoors = [
    {
      label: "Something's wrong",
      description: 'Tell us the symptom and get routed to a diagnostic or repair.',
      icon: <WrenchIcon />,
      to: '/intake/something-wrong'
    },
    {
      label: 'Tires & maintenance',
      description: 'Book tire replacement or routine service.',
      icon: <TireIcon />,
      to: '/intake/tires'
    },
    {
      label: 'Bodywork & paint',
      description: 'Start a body/paint consultation.',
      icon: <SprayIcon />,
      to: '/intake/bodywork'
    }
  ];

  return (
    <section className="home">
      {/* Video: user-provided (apps/web/public/hero.mp4, 1916x1080/10s). hero-mobile.mp4 is a
          960px-wide mobile spec variant (ffmpeg: scale=960:-2, libx264 CRF 18 "preset slow" for
          visual quality parity with the source, audio stream copied byte-for-byte — untouched
          quality/volume, not re-encoded) — 24MB down to ~3MB. <source media> picks the right file
          per viewport the same way <picture> does for images; posters are real extracted first
          frames per variant, so there's no flash-of-different-image before playback starts.
          autoPlay is only set when the visitor hasn't requested reduced motion — without autoPlay
          a <video> simply displays its poster as a static image, so reduced-motion users still
          see the scene, just not moving. */}
      <div className="hero">
        <video
          className="hero-video"
          poster={isMobileViewport ? '/hero-poster-mobile.jpg' : '/hero-poster.jpg'}
          autoPlay={!prefersReducedMotion}
          loop
          muted
          playsInline
          aria-hidden="true"
        >
          <source src="/hero-mobile.mp4" media={MOBILE_VIDEO_QUERY} type="video/mp4" />
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        <div className="hero-content">
          <h1 className="hero-brand">
            {/* Real logo (apps/web/public/logo.png, from the user), replacing the earlier
                text-based "Travel" / "Automotive" wordmark. WebP primary (74.5KB vs. the
                source PNG's 727KB — ffmpeg, same transparency, visually identical) with the
                original PNG as a <picture> fallback for browsers without WebP support. */}
            <picture>
              <source srcSet="/logo.webp" type="image/webp" />
              <img src="/logo.png" alt="Travel Automotive — Mobile Mechanic" className="hero-logo" />
            </picture>
          </h1>
        </div>
      </div>

      {/* Relocated off the video per feedback: the four-sentence promise reads more reliably on
          a plain dark card than fighting a moving background, even a well-scrimmed one. */}
      <section className="promise-card" aria-labelledby="promise-heading">
        <h2
          id="promise-heading"
          ref={promiseRef}
          className={`promise-headline${promiseInView ? ' is-in-view' : ''}`}
        >
          {HERO_LINES.map((line, index) => (
            <span
              key={line}
              className="promise-line"
              style={{ color: `var(--hero-line-${index + 1})`, transitionDelay: `${index * 0.15}s` }}
            >
              {line}
            </span>
          ))}
        </h2>
        <p>Every path below starts with your vehicle.</p>
      </section>

      <div className="entry-doors">
        {entryDoors.map((door, index) => (
          <Link key={door.label} to={door.to} className="entry-door" style={{ animationDelay: `${index * 0.08}s` }}>
            {door.icon}
            <h2>{door.label}</h2>
            <p>{door.description}</p>
            {/* The whole card is the <Link>, so this is a styled affordance (span), not a
                nested interactive element — a real <button> inside an <a> is invalid HTML. */}
            <span className="entry-door-cta">Get started</span>
          </Link>
        ))}
      </div>
      <section aria-labelledby="catalog-heading">
        <h2 id="catalog-heading">What we offer</h2>
        {catalog.isPending && <p role="status">Loading services&hellip;</p>}
        {catalog.isError && <ErrorPanel error={catalog.error} onRetry={() => catalog.refetch()} />}
        {catalog.data && catalog.data.data.length === 0 && <p>No services are published yet.</p>}
        {catalog.data && catalog.data.data.length > 0 && (
          <ul className="service-list">
            {catalog.data.data.map((service, index) => (
              <li key={service.id} className="service-card" style={{ animationDelay: `${index * 0.08}s` }}>
                <strong>{service.name}</strong>
                <span>{service.delivery.join(' / ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
