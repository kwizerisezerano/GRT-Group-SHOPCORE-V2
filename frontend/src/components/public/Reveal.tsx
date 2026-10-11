import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Reveals its children the first time they scroll into view.
 *
 * ## Why an observer rather than a CSS animation
 *
 * A plain `animate-rise` on every section runs the moment the page loads, so
 * everything below the fold has finished animating before anyone has scrolled
 * to it — which is the same as no animation at all, except it also delays the
 * content at the top. This waits for the element to actually approach the
 * viewport.
 *
 * ## Reduced motion
 *
 * Honoured, and honoured properly: someone who has asked their system for less
 * motion gets the content immediately and fully visible, not a shorter
 * animation. Also the fallback when `IntersectionObserver` is missing — the
 * failure mode of a reveal component must never be invisible content.
 *
 * `once` by default. Re-animating on every scroll past is the thing that makes
 * a page feel restless rather than alive.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  /** Milliseconds, for staggering siblings. Keep under ~300ms. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      {
        // Fires a little before the element is on screen, so the motion has
        // finished by the time the reader's eye arrives.
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.05,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      /*
       * Printing never scrolls, so the observer never fires and everything
       * below the fold would come out blank. index.css forces these visible
       * in a print context; the attribute is what it hooks onto.
       */
      data-reveal={shown ? "shown" : "pending"}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        className,
      )}
      style={shown && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
