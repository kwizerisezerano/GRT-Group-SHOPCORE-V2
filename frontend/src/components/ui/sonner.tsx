import type { ComponentProps } from "react";
import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast border-border bg-card text-card-foreground shadow-lg",
          description:
            "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };