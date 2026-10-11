import { Download, FileText, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportMenuProps {
  onCSV: () => void;
  onPDF: () => void;
  /**
   * Optional. Given one, the menu grows a Print entry — the browser dialogue
   * it opens also offers "Save as PDF", so this covers both printing a report
   * and handing someone a file without leaving the page.
   */
  onPrint?: () => void;
  label?: string;
  size?: "sm" | "default";
}

export function ExportMenu({
  onCSV,
  onPDF,
  onPrint,
  label = "Export",
  size = "sm",
}: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="gap-2 rounded-xl">
          <Download className="h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onCSV} className="cursor-pointer">
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Download CSV
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onPDF} className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4" /> Download PDF
        </DropdownMenuItem>

        {onPrint ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPrint} className="cursor-pointer">
              <Printer className="mr-2 h-4 w-4" /> Print
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
