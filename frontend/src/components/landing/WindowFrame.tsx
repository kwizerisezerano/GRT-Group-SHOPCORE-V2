import { type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import {
  Maximize2,
  Minus,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

type StatusTone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

type WindowFrameProps = {
  title: string;
  eyebrow?: string;
  icon?: LucideIcon;
  status?: string;
  statusTone?: StatusTone;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  showControls?: boolean;
} & Omit<HTMLMotionProps<"div">, "children">;

const toneMap: Record<StatusTone, string> = {
  blue: "border-border bg-muted text-foreground",
  emerald: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
};

const pulseMap: Record<StatusTone, string> = {
  blue: "bg-blue-500",
  emerald: "bg-blue-500",
  orange: "bg-blue-500",
  rose: "bg-blue-500",
  violet: "bg-blue-500",
  cyan: "bg-blue-500",
};

export default function WindowFrame({
  title,
  eyebrow,
  icon: Icon,
  status,
  statusTone = "blue",
  children,
  className = "",
  bodyClassName = "",
  showControls = true,
  ...motionProps
}: WindowFrameProps) {
  return (
    <motion.div
      initial={motionProps.initial ?? { opacity: 0, y: 12 }}
      whileInView={motionProps.whileInView ?? { opacity: 1, y: 0 }}
      viewport={motionProps.viewport ?? { once: true, margin: "-80px" }}
      transition={motionProps.transition ?? { duration: 0.45, ease: "easeOut" }}
      className={[
        "overflow-hidden rounded-2xl border border-border bg-card/90 shadow-[0_28px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl",
        className,
      ].join(" ")}
      {...motionProps}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/80 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center text-foreground">
              <Icon className="h-4 w-4" />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground break-words leading-tight line-clamp-2">
                {eyebrow}
              </p>
            ) : null}

            <h3 className="truncate text-sm font-bold text-slate-900 dark:!text-blue-100 break-words leading-tight line-clamp-2">
              {title}
            </h3>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {status ? (
            <motion.span
              key={status}
              initial={{ opacity: 0.65, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className={[
                "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:inline-flex",
                toneMap[statusTone],
              ].join(" ")}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full",
                  pulseMap[statusTone],
                ].join(" ")}
              />
              {status}
            </motion.span>
          ) : null}

          {showControls ? (
            <div className="hidden items-center gap-1 rounded-full border border-border bg-card px-1.5 py-1 text-muted-foreground sm:flex">
              <Minus className="h-3.5 w-3.5" />
              <Maximize2 className="h-3.5 w-3.5" />
              <MoreHorizontal className="h-3.5 w-3.5" />
            </div>
          ) : null}
        </div>
      </div>

      <div className={["p-4", bodyClassName].join(" ")}>{children}</div>
    </motion.div>
  );
}
