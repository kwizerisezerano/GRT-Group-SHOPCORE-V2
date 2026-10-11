import type { ComponentProps } from "react";
import { Toaster as Sonner, toast } from "sonner";

import { useTheme } from "@/contexts/ThemeContext";

type ToasterProps = ComponentProps<typeof Sonner>;

/**
 * The app's toasts.
 *
 * ## Why these settings
 *
 * `richColors` gives success, error and warning their own tone. Without it
 * every toast is the same neutral card, so "payment received" and "payment
 * declined" look identical for the half second someone spends glancing at
 * them — on the one screen where that distinction is the whole message.
 *
 * `closeButton` because a payment toast is deliberately long-lived (a person
 * reading a reference number should not be racing a timer), and anything that
 * stays needs a way to be dismissed.
 *
 * `expand` keeps stacked toasts readable rather than collapsing them into a
 * pile — a payment flow can legitimately raise two in succession ("sending the
 * prompt", then "payment received").
 *
 * ## The animation
 *
 * Sonner's own enter/exit is a slide with a spring. What is added here is the
 * easing curve the rest of the product uses — the same
 * `cubic-bezier(0.22, 1, 0.36, 1)` as the workspace's `rise` animation — so a
 * toast arrives like everything else in the app rather than like a component
 * from a different product. Honoured `motion-reduce`, because a person who
 * asked for less motion should still get the message, just without the travel.
 */
const Toaster = (props: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      expand
      visibleToasts={4}
      duration={5000}
      gap={10}
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto border-border bg-card text-card-foreground shadow-lg rounded-xl " +
            "data-[state=open]:animate-in data-[state=closed]:animate-out " +
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 " +
            "data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-right-2 " +
            "data-[state=open]:zoom-in-95 " +
            "duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none",
          title: "text-[13.5px] font-semibold",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-[12.5px]",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:font-semibold",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          closeButton: "group-[.toast]:border-border group-[.toast]:bg-card",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
