import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn } from 'lucide-react';

interface AvatarCropDialogProps {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onCrop: (blob: Blob) => void;
}

const CROP_SIZE = 256;
const CONTAINER_SIZE = 240;

export function AvatarCropDialog({ open, file, onClose, onCrop }: AvatarCropDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 0, h: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      return () => URL.revokeObjectURL(url);
    }
    setImageUrl(null);
  }, [file]);

  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  // Calculate displayed image dimensions
  const getDisplayedSize = useCallback(() => {
    if (!imgNaturalSize.w || !imgNaturalSize.h) return { w: CONTAINER_SIZE, h: CONTAINER_SIZE };
    const aspect = imgNaturalSize.w / imgNaturalSize.h;
    let w: number, h: number;
    if (aspect >= 1) {
      // landscape: height fits container
      h = CONTAINER_SIZE * zoom;
      w = h * aspect;
    } else {
      // portrait: width fits container
      w = CONTAINER_SIZE * zoom;
      h = w / aspect;
    }
    return { w, h };
  }, [imgNaturalSize, zoom]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const { w, h } = getDisplayedSize();
    const maxX = Math.max(0, (w - CONTAINER_SIZE) / 2);
    const maxY = Math.max(0, (h - CONTAINER_SIZE) / 2);
    const newX = Math.min(maxX, Math.max(-maxX, e.clientX - dragStart.x));
    const newY = Math.min(maxY, Math.max(-maxY, e.clientY - dragStart.y));
    setPosition({ x: newX, y: newY });
  }, [dragging, dragStart, getDisplayedSize]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleCrop = useCallback(() => {
    const img = imgRef.current;
    if (!img || !imgNaturalSize.w) return;

    const { w, h } = getDisplayedSize();

    // Map from display coordinates to natural image coordinates
    const scaleX = imgNaturalSize.w / w;
    const scaleY = imgNaturalSize.h / h;

    // The visible area center in display coords is at (w/2 - position.x, h/2 - position.y)
    // The crop square is CONTAINER_SIZE centered in the container
    const cropDisplayX = (w - CONTAINER_SIZE) / 2 - position.x;
    const cropDisplayY = (h - CONTAINER_SIZE) / 2 - position.y;

    const sx = cropDisplayX * scaleX;
    const sy = cropDisplayY * scaleY;
    const sSize = CONTAINER_SIZE * scaleX;

    const canvas = document.createElement('canvas');
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, sx, sy, sSize, sSize * (scaleX / scaleY), 0, 0, CROP_SIZE, CROP_SIZE);
    canvas.toBlob(
      (blob) => {
        if (blob) onCrop(blob);
      },
      'image/jpeg',
      0.9
    );
  }, [imgNaturalSize, getDisplayedSize, position, onCrop]);

  const { w: displayW, h: displayH } = getDisplayedSize();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar foto de perfil</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {/* Crop area */}
          <div
            className="relative overflow-hidden rounded-full border-2 border-primary/30 cursor-grab active:cursor-grabbing"
            style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {imageUrl && (
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Preview"
                onLoad={handleImageLoad}
                draggable={false}
                className="select-none pointer-events-none absolute"
                style={{
                  width: displayW,
                  height: displayH,
                  left: (CONTAINER_SIZE - displayW) / 2 + position.x,
                  top: (CONTAINER_SIZE - displayH) / 2 + position.y,
                }}
              />
            )}
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3 w-full max-w-[240px]">
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              min={1}
              max={3}
              step={0.05}
              className="flex-1"
            />
          </div>

          <p className="text-xs text-muted-foreground">Arrastra para mover · Usa el slider para zoom</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCrop}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
