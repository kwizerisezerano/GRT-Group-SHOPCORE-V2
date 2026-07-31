import { useEffect, useMemo, useRef, useState } from "react";

type AnimatedCounterProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  compact?: boolean;
  decimals?: number;
  duration?: number;
  className?: string;
};

const formatValue = (value: number, compact: boolean, decimals: number) => {
  const safeValue = Number.isFinite(value) ? value : 0;

  if (!compact) {
    return safeValue.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  if (Math.abs(safeValue) >= 1_000_000) {
    return `${(safeValue / 1_000_000).toFixed(decimals)}M`;
  }

  if (Math.abs(safeValue) >= 1_000) {
    return `${(safeValue / 1_000).toFixed(decimals)}K`;
  }

  return safeValue.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export default function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  compact = false,
  decimals = 0,
  duration = 650,
  className,
}: AnimatedCounterProps) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState(safeValue);
  const previousValueRef = useRef(safeValue);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const change = safeValue - startValue;

    if (Math.abs(change) < 0.001) {
      setDisplayValue(safeValue);
      previousValueRef.current = safeValue;
      return;
    }

    const startTime = performance.now();
    let animationFrame = 0;

    const animate = (currentTime: number) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + change * easedProgress;

      setDisplayValue(nextValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(safeValue);
        previousValueRef.current = safeValue;
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [duration, safeValue]);

  const formattedValue = useMemo(
    () => formatValue(displayValue, compact, decimals),
    [compact, decimals, displayValue],
  );

  return (
    <span className={className}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
}