import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readerId = "barcode-reader";

  useEffect(() => {
    if (!open) return;

    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText);
          scanner.stop().catch(() => {});
          onClose();
        },
        () => {}
      )
      .catch((err) => {
        setError("Camera access denied or unavailable. Please allow camera permission.");
        console.error(err);
      });

    return () => {
      scanner.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan Barcode / QR Code
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div
            id={readerId}
            className="w-full rounded-lg overflow-hidden bg-muted min-h-[280px]"
          />
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Point your camera at a barcode or QR code to scan it
          </p>
          <Button variant="outline" className="w-full" onClick={onClose}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
