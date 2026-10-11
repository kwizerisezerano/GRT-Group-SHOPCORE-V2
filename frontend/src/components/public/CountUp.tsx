import { useEffect, useRef, useState } from "react";

/**
 * Counts from zero to `value` the first time it is scrolled into view.
 *
 * ## Why rAF and not an interval
 *
 * An interval ticking the number every 30ms fires whether or not the browser
 * is ready to paint, so on a busy page the count stutters and lands late.
 * `requestAnimationFrame` is paused with the tab, driven by real elapsed time
 * rather than a tick count, and always finishes exactly on `value` — an
 * interval that increments by a step can overshoot and have to clamp back.
 *
 * ## Reduced motion, and the layout
 *
 * Someone who has asked for less motion gets the final number immediately.
 * The digits render in `font-data` (tabular figures) at the call site, so a
 * number climbing from 8 to 96 does not shove the label beside it around
 * while it counts.
 */
export function CountUp({
  value,
  duration = 1100,
  suffix = "",
}: {
  value: number;
  /** Milliseconds for the whole climb. */
  duration?: number;
  suffix?: string;
}) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(value);
      return;
    }

    let frame = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || started.current) continue;

          started.current = true;
          observer.disconnect();

          const startedAt = performance.now();

          const step = (now: number) => {
            const progress = Math.min((now - startedAt) / duration, 1);
            // Ease-out cubic: quick off the mark, settles onto the number.
            const eased = 1 - Math.pow(1 - progress, 3);

            setShown(Math.round(eased * value));
            if (progress < 1) frame = requestAnimationFrame(step);
          };

          frame = requestAnimationFrame(step);
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref}>
      {shown}
      {suffix}
    </span>
  );
}
