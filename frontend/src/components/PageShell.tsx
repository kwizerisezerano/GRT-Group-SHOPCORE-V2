import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface PageShellProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function PageShell({ title, description, actionLabel, onAction, children }: PageShellProps) {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
        {actionLabel && (
          <Button onClick={onAction} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            {actionLabel}
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}
