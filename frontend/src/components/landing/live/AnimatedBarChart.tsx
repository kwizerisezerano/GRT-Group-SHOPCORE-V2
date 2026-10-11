import { motion } from "framer-motion";

type AnimatedBarChartProps = {
  values: number[];
  heightClassName?: string;
  barClassName?: string;
  trackClassName?: string;
  className?: string;
};

const clamp = (value: number) => Math.min(100, Math.max(4, value));

export default function AnimatedBarChart({
  values,
  heightClassName = "h-52",
  barClassName = "bg-blue-600",
  trackClassName = "bg-muted",
  className = "",
}: AnimatedBarChartProps) {
  const safeValues = values.length ? values : [48, 64, 52, 78, 69, 91];

  return (
    <div
      className={[
        "flex items-end gap-2 rounded-2xl border border-border bg-gradient-to-b from-muted to-background p-4",
        heightClassName,
        className,
      ].join(" ")}
    >
      {safeValues.map((value, index) => (
        <div
          key={`bar-${index}`}
          className={[
            "flex flex-1 items-end overflow-hidden rounded-full",
            trackClassName,
          ].join(" ")}
          style={{ height: "100%" }}
        >
          <motion.div
            initial={false}
            animate={{ height: `${clamp(value)}%` }}
            transition={{
              duration: 0.75,
              ease: "easeOut",
              delay: index * 0.015,
            }}
            className={["w-full rounded-full", barClassName].join(" ")}
          />
        </div>
      ))}
    </div>
  );
}