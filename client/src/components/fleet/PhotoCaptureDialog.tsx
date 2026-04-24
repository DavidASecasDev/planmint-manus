/**
 * PhotoCaptureDialog — Reusable photo capture component for fleet inspections.
 *
 * Features:
 * - Two buttons: "Cámara" (opens camera directly) and "Galería" (opens photo picker)
 * - Instant preview of captured/selected photo with compression info
 * - "Repetir" / "Usar foto" actions before confirming
 * - "Anotar" button to open PhotoAnnotator for drawing on the photo
 * - Supports multiple photos in sequence
 * - Uses existing compressImage utility for automatic compression
 */

import { useRef, useState, useCallback } from 'react';
import { Camera, Images, RotateCcw, Check, X, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { compressImage, formatBytes, compressionSavings, type CompressImageResult } from '@/lib/imageCompression';
import { PhotoAnnotator } from './PhotoAnnotator';

interface PhotoCaptureDialogProps {
  /** Called with the compressed file and preview URL when user confirms */
  onConfirm: (files: Array<{ file: File; preview: string }>) => void;
  /** Called when user closes/cancels the dialog */
  onClose: () => void;
  /** Allow selecting multiple photos at once from gallery. Default: true */
  multiple?: boolean;
  /** Label shown at the top. Default: "Añadir foto" */
  label?: string;
}

interface PendingImage {
  file: File;
  preview: string;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}

export function PhotoCaptureDialog({
  onConfirm,
  onClose,
  multiple = true,
  label = 'Añadir foto',
}: PhotoCaptureDialogProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<PendingImage[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [mode, setMode] = useState<'choose' | 'preview' | 'annotate'>('choose');
  const [annotatingIndex, setAnnotatingIndex] = useState<number>(0);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setCompressing(true);
    try {
      const results: CompressImageResult[] = await Promise.all(
        Array.from(files).map((f) => compressImage(f)),
      );
      const images: PendingImage[] = results.map((r) => ({
        file: r.file,
        preview: r.preview || URL.createObjectURL(r.file),
        originalSize: r.originalSize,
        compressedSize: r.compressedSize,
        wasCompressed: r.wasCompressed,
      }));
      setPending(images);
      setMode('preview');
    } catch {
      // Fallback: use originals without compression
      const images: PendingImage[] = Array.from(files).map((f) => ({
        file: f,
        preview: URL.createObjectURL(f),
        originalSize: f.size,
        compressedSize: f.size,
        wasCompressed: false,
      }));
      setPending(images);
      setMode('preview');
    } finally {
      setCompressing(false);
    }
  }, []);

  const handleCameraChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      processFiles(files);
      e.target.value = '';
    },
    [processFiles],
  );

  const handleGalleryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      processFiles(files);
      e.target.value = '';
    },
    [processFiles],
  );

  const handleConfirm = useCallback(() => {
    onConfirm(pending.map((p) => ({ file: p.file, preview: p.preview })));
  }, [pending, onConfirm]);

  const handleRetake = useCallback(() => {
    // Clean up previews
    pending.forEach((p) => {
      if (p.preview.startsWith('blob:')) URL.revokeObjectURL(p.preview);
    });
    setPending([]);
    setMode('choose');
  }, [pending]);

  const removeImage = useCallback((idx: number) => {
    setPending((prev) => {
      const removed = prev[idx];
      if (removed.preview.startsWith('blob:')) URL.revokeObjectURL(removed.preview);
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) {
        setMode('choose');
      }
      return next;
    });
  }, []);

  const handleAnnotate = useCallback((idx: number) => {
    setAnnotatingIndex(idx);
    setMode('annotate');
  }, []);

  const handleAnnotationConfirm = useCallback(
    (file: File, preview: string) => {
      setPending((prev) => {
        const updated = [...prev];
        // Clean up old preview
        if (updated[annotatingIndex].preview.startsWith('blob:')) {
          URL.revokeObjectURL(updated[annotatingIndex].preview);
        }
        updated[annotatingIndex] = {
          ...updated[annotatingIndex],
          file,
          preview,
          compressedSize: file.size,
        };
        return updated;
      });
      setMode('preview');
    },
    [annotatingIndex],
  );

  const handleAnnotationCancel = useCallback(() => {
    setMode('preview');
  }, []);

  const totalOriginal = pending.reduce((s, p) => s + p.originalSize, 0);
  const totalCompressed = pending.reduce((s, p) => s + p.compressedSize, 0);
  const savings = compressionSavings(totalOriginal, totalCompressed);

  return (
    <div className="space-y-3">
      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={handleGalleryChange}
      />

      {/* Mode: Choose — camera or gallery */}
      {mode === 'choose' && !compressing && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl flex-1 h-11"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-4 w-4 mr-1.5" />
              Cámara
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl flex-1 h-11"
              onClick={() => galleryInputRef.current?.click()}
            >
              <Images className="h-4 w-4 mr-1.5" />
              Galería
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-full rounded-xl text-muted-foreground"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancelar
          </Button>
        </div>
      )}

      {/* Compressing indicator */}
      {compressing && (
        <div className="w-full py-8 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Comprimiendo foto...</p>
        </div>
      )}

      {/* Mode: Preview — show captured photos with confirm/retake/annotate */}
      {mode === 'preview' && pending.length > 0 && (
        <div className="space-y-3">
          {/* Photo grid */}
          {pending.length === 1 ? (
            <div className="relative rounded-xl overflow-hidden border border-border bg-muted/20 group">
              <img
                src={pending[0].preview}
                alt="Foto capturada"
                className="w-full aspect-[4/3] object-cover"
              />
              {/* Annotate overlay button on single photo */}
              <button
                type="button"
                onClick={() => handleAnnotate(0)}
                className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
                title="Anotar daños"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {pending.map((p, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-border/50 group">
                  <img src={p.preview} alt="" className="w-full aspect-square object-cover" />
                  {/* Annotate button */}
                  <button
                    type="button"
                    onClick={() => handleAnnotate(idx)}
                    className="absolute top-1 left-1 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
                    title="Anotar daños"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Compression info */}
          {savings > 0 && (
            <p className="text-[11px] text-muted-foreground text-center">
              Comprimido: {formatBytes(totalOriginal)} → {formatBytes(totalCompressed)} ({savings}% reducido)
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleRetake}
              className="flex-1 h-11 rounded-xl"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Repetir
            </Button>
            {pending.length === 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAnnotate(0)}
                className="h-11 rounded-xl px-3"
                title="Anotar daños en la foto"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              onClick={handleConfirm}
              className="flex-1 h-11 rounded-xl"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Usar {pending.length > 1 ? `${pending.length} fotos` : 'foto'}
            </Button>
          </div>
        </div>
      )}

      {/* Mode: Annotate — draw on the photo */}
      {mode === 'annotate' && pending[annotatingIndex] && (
        <PhotoAnnotator
          imageSrc={pending[annotatingIndex].preview}
          onConfirm={handleAnnotationConfirm}
          onCancel={handleAnnotationCancel}
        />
      )}
    </div>
  );
}
