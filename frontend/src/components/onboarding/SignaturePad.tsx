import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Signing: drawn with a finger or a mouse, or uploaded as an image.
 *
 * ## Why both
 *
 * Drawing works on a phone and is what most people reach for. It is also
 * genuinely awkward with a trackpad, and a business that already has its
 * signature as a scan or a photograph should not be made to re-draw it badly.
 * Two tabs, one value out: either way this hands back a PNG data URL, and
 * everything downstream — the preview, the stored contract, the PDF — treats
 * them identically.
 *
 * ## Pointer events, not mouse or touch
 *
 * One set of handlers covers a phone, a laptop trackpad and a stylus. Mouse
 * handlers alone would leave the pad dead on the phones most Rwandan retailers
 * sign up on, and running both sets means a touch that also emits compatibility
 * mouse events draws two overlapping strokes.
 *
 * `setPointerCapture` keeps the stroke attached to the pad when a finger slides
 * past its edge mid-signature, which otherwise ends the line at the border.
 *
 * ## Why the canvas is sized in an effect, and why resizing preserves the mark
 *
 * A canvas has two sizes — its CSS box and its bitmap — and they are unrelated.
 * Left at the 300×150 default bitmap while CSS stretched it wider, every stroke
 * came out blurred and horizontally skewed. So the bitmap is measured from the
 * real box and scaled by the device pixel ratio.
 *
 * The catch is that *assigning* `canvas.width` clears the canvas, so the naive
 * version erased somebody's signature the moment they rotated their phone or
 * opened dev tools — the captured data was still fine, which made it worse: the
 * pad looked empty while the contract had already been generated from a mark
 * the person could no longer see. Now the bitmap is only rebuilt when the size
 * genuinely changed, and the last stroke is redrawn onto the new bitmap.
 */

type Mode = "draw" | "upload";

/** Two megabytes — a photographed signature, not a scanned document. */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export function SignaturePad({
  onChange,
  className,
  label = "Sign here",
  value = null,
  required = true,
  hint,
}: {
  /** Fires with a PNG or JPEG data URL, or null when cleared. */
  onChange: (dataUrl: string | null) => void;
  className?: string;
  label?: string;
  /**
   * A signature this pad should open holding — one restored from a draft, or
   * one already stored on a contract template.
   *
   * Shown as an image rather than pushed back onto the canvas. Re-inking a
   * bitmap at whatever size the box happens to be now is how a restored
   * signature comes back subtly stretched, and a signature is the one image
   * that must not be. Clearing it returns the pad to its normal two tabs.
   */
  value?: string | null;
  /** Whether the field is marked with the required asterisk. */
  required?: boolean;
  /** Replaces the line of guidance under the pad. */
  hint?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const drawing = useRef(false);

  /** The last committed stroke, redrawn if the canvas has to be rebuilt. */
  const lastInk = useRef<string | null>(null);
  /** The bitmap size already in place, so an unchanged resize is a no-op. */
  const bitmap = useRef<{ width: number; height: number } | null>(null);

  const [mode, setMode] = useState<Mode>("draw");
  const [hasInk, setHasInk] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);

  /*
   * A signature handed in from outside, held separately from the two tabs.
   *
   * It is not "drawn" and it is not "uploaded" — it is already made, and the
   * only two things anybody wants to do with it are look at it and replace it.
   * Kept in state rather than read from the prop directly so clearing it works
   * without the parent having to co-operate.
   */
  const [restored, setRestored] = useState<string | null>(value);

  /*
   * A later value — a draft that arrived after the first paint — replaces what
   * is shown, but only while the person has not started signing. Overwriting a
   * mark somebody is halfway through making would be worse than showing a
   * stale one.
   */
  useEffect(() => {
    if (!value) return;
    setRestored((previous) => (previous || hasInk || uploaded ? previous : value));
  }, [value, hasInk, uploaded]);

  const context = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    // Ink is near-black rather than themed: this image is printed onto a white
    // PDF page, where a dark-theme foreground would be invisible.
    ctx.strokeStyle = "#101322";

    return ctx;
  };

  /** Matches the bitmap to the box, at device resolution, keeping the mark. */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);

    // Assigning width/height clears the canvas even when the value is the same,
    // so an unchanged size must not touch them at all.
    if (bitmap.current?.width === width && bitmap.current?.height === height) return;

    const snapshot = lastInk.current;

    canvas.width = width;
    canvas.height = height;
    bitmap.current = { width, height };

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(ratio, ratio);

    if (snapshot) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height);
      image.src = snapshot;
    }
  }, []);

  useEffect(() => {
    // Only while the canvas is on screen — in upload mode there is nothing to
    // measure, and `getBoundingClientRect` on a hidden element reads zero.
    if (mode !== "draw") return;

    resize();

    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [mode, resize]);

  const pointAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = context();
    if (!ctx) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;

    const { x, y } = pointAt(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;

    const ctx = context();
    if (!ctx) return;

    const { x, y } = pointAt(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;

    drawing.current = false;
    setHasInk(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    lastInk.current = dataUrl;
    onChange(dataUrl);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    lastInk.current = null;
    setHasInk(false);
    setUploaded(null);
    setRestored(null);
    onChange(null);
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("That image is too large", { description: "Please use a file under 2 MB." });
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") return;

      setUploaded(reader.result);
      onChange(reader.result);
    };

    reader.onerror = () => toast.error("That image could not be read.");
    reader.readAsDataURL(file);
  };

  /**
   * Switching tabs drops whatever the other tab held.
   *
   * Keeping both would mean two candidate signatures and no way for the person
   * to tell which one is going on their contract.
   */
  const switchTo = (next: Mode) => {
    if (next === mode) return;

    clear();
    setMode(next);
  };

  const filled = restored ? true : mode === "draw" ? hasInk : Boolean(uploaded);

  return (
    <div className={cn("space-y-2", className)}>
      {/*
        One header row, the same height as the stamp column's, so the two boxes
        below start on the same line. The tabs used to sit in a row of their own
        between the label and the pad, which pushed the pad 40px below the stamp
        box beside it and made the pair look misaligned rather than paired.
      */}
      <div className="flex h-7 items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-foreground">
          {label} {required ? <span className="font-normal text-destructive">*</span> : null}
        </span>

        <div className="flex items-center gap-1">
          {/* The tabs are the choice between making a mark two ways. With one
              already in hand there is nothing to choose, so they step aside for
              the Clear button that replaces it. */}
          {restored
            ? null
            : (
                [
                  ["draw", "Draw", PenLine],
                  ["upload", "Upload", Upload],
                ] as const
              ).map(([tab, text, Icon]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => switchTo(tab)}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors",
                    mode === tab
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {text}
                </button>
              ))}

          {filled ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={clear}
            >
              <Eraser className="mr-1 h-3 w-3" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {restored ? (
        <div className="h-40 rounded-2xl border border-border bg-[#ffffff] p-2">
          <img src={restored} alt="Your signature" className="h-full w-full object-contain" />
        </div>
      ) : mode === "draw" ? (
        /*
          The pad reads as a signature line, not an empty white void: a ruled
          baseline with a cross at the left, the way a paper contract marks the
          place to sign. Purely decorative — it is drawn in the wrapper, not on
          the canvas, so it never ends up in the captured image.
        */
        <div className="relative h-40 overflow-hidden rounded-2xl border border-border bg-[#ffffff]">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-slate-300"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[26px] left-6 text-[13px] font-semibold text-slate-400"
          >
            ✕
          </span>

          <canvas
            ref={canvasRef}
            // `touch-none` matters: without it a finger scrolls the page instead
            // of drawing, and the pad appears broken on exactly the devices it
            // is for.
            className="relative h-full w-full cursor-crosshair touch-none"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            onPointerCancel={end}
          />
        </div>
      ) : uploaded ? (
        <div className="h-40 rounded-2xl border border-border bg-[#ffffff] p-2">
          <img src={uploaded} alt="Your signature" className="h-full w-full object-contain" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <Upload className="h-5 w-5" />
          <span className="text-sm font-medium text-foreground">Upload your signature</span>
          <span className="text-xs">PNG or JPG, under 2 MB</span>
        </button>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(event) => pickFile(event.target.files?.[0])}
      />

      <p className="text-xs text-muted-foreground">
        {hint ??
          (filled
            ? "Signed. You can clear it and sign again if you would like."
            : mode === "draw"
              ? "Draw your signature on the line above."
              : "Choose a scan or photo of your signature.")}
      </p>
    </div>
  );
}
