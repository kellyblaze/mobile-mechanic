import { useCallback, useEffect, useRef, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const onChange = () => setMatches(mediaQueryList.matches);
    onChange();
    mediaQueryList.addEventListener('change', onChange);
    return () => mediaQueryList.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

// Fires once, the first time the element scrolls into view, then disconnects — an entrance
// reveal, not a repeating/ambient one. Reduced-motion visitors still get this (IntersectionObserver
// isn't gated by that preference); the site's global prefers-reduced-motion rule (transition:
// none !important on *) just makes the state change instant instead of animated once it fires.
// A callback ref, not useRef + useEffect: several call sites (RepairRoom) conditionally return
// a loading/error state *before* the heading with this ref ever renders. A plain ref's .current
// changing from null to the real node doesn't re-run an effect (refs aren't reactive), so that
// pattern left the heading permanently stuck at opacity:0 — confirmed live (RepairRoom's
// .page-heading never gained .is-in-view). A callback ref fires exactly when React actually
// attaches the node, regardless of how many renders happened before that, which fixes it.
export function useInViewOnce<T extends HTMLElement>(threshold = 0.3) {
  const [isInView, setIsInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        },
        { threshold }
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [threshold]
  );

  return { ref, isInView };
}
