import type { ReactNode } from "react";

interface PageBackgroundProps {
  image: string;
  children: ReactNode;
  /** 0-1, defaults to 0.08 — keep low for table readability */
  opacity?: number;
  className?: string;
}

/**
 * Wraps a page with a faded full-page background image.
 * Sits behind all content with a subtle gradient overlay so text stays readable.
 */
export function PageBackground({ image, children, opacity = 0.18, className = "" }: PageBackgroundProps) {
  return (
    <div className={`relative -m-6 p-6 min-h-[calc(100vh-3.5rem)] ${className}`}>
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${image})`, opacity }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background"
        aria-hidden="true"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
