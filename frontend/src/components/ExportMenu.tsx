import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportMenuProps {
  onCSV: () => void;
  onPDF: () => void;
  label?: string;
  size?: "sm" | "default";
}

export function ExportMenu({ onCSV, onPDF, label = "Export", size = "sm" }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="gap-2">
          <Download className="w-4 h-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onCSV} className="cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPDF} className="cursor-pointer">
          <FileText className="w-4 h-4 mr-2" /> Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
