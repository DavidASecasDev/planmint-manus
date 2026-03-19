import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, RotateCcw, Check, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DamageCameraProps {
  onCapture: (file: File, preview: string) => void;
  onClose: () => void;
}

function compressToBlob(
  source: HTMLVideoElement | HTMLImageElement,
  maxWidth = 1920,
  quality = 0.8,
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
    const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
    const scale = Math.min(1, maxWidth / sw);
    canvas.width = sw * scale;
    canvas.height = sh * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    canvas.toBlob(
      (blob) => resolve({ blob: blob!, dataUrl }),
      'image/jpeg',
      quality,
    );
  });
}

export function DamageCamera({ onCapture, onClose }: DamageCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'starting' | 'streaming' | 'preview' | 'fallback'>('starting');
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  // Start embedded camera on mount
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
        // No getUserMedia — fall back to native input
        setMode('fallback');
        setTimeout(() => fileInputRef.current?.click(), 100);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setMode('streaming');
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        });
      } catch {
        if (cancelled) return;
        setMode('fallback');
        setTimeout(() => fileInputRef.current?.click(), 100);
      }
    };

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const captureFromStream = useCallback(async () => {
    if (!videoRef.current) return;
    const { blob, dataUrl } = await compressToBlob(videoRef.current);
    setCapturedBlob(blob);
    setPreview(dataUrl);
    stopCamera();
    setMode('preview');
  }, [stopCamera]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // User cancelled — close camera
      onClose();
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const raw = reader.result as string;
      if (!raw) return;
      const img = new Image();
      img.onload = async () => {
        const { blob, dataUrl } = await compressToBlob(img);
        setCapturedBlob(blob);
        setPreview(dataUrl);
        setMode('preview');
      };
      img.onerror = () => {
        // Use raw
        fetch(raw)
          .then((r) => r.blob())
          .then((b) => {
            setCapturedBlob(b);
            setPreview(raw);
            setMode('preview');
          });
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (!capturedBlob || !preview) return;
    const file = new File([capturedBlob], `damage_${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file, preview);
  }, [capturedBlob, preview, onCapture]);

  const handleRetake = useCallback(() => {
    setPreview(null);
    setCapturedBlob(null);
    setMode('starting');
    // Restart camera
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        setMode('streaming');
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        });
      } catch {
        setMode('fallback');
        setTimeout(() => fileInputRef.current?.click(), 100);
      }
    })();
  }, []);

  return (
    <div className="space-y-3">
      {/* Hidden native fallback input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Starting — loading indicator */}
      {mode === 'starting' && (
        <div className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin border-2 border-primary border-t-transparent rounded-full" />
          <p className="text-sm text-muted-foreground">Iniciando cámara…</p>
        </div>
      )}

      {/* Streaming — embedded camera view */}
      {mode === 'streaming' && (
        <div className="rounded-xl overflow-hidden border border-border bg-black relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-[4/3] object-cover"
          />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4 flex justify-center">
            <button
              type="button"
              onClick={captureFromStream}
              className="w-16 h-16 rounded-full bg-white border-4 border-white/50 shadow-lg active:scale-90 transition-transform"
              aria-label="Capturar foto"
            />
          </div>
        </div>
      )}

      {/* Fallback — waiting for native input */}
      {mode === 'fallback' && (
        <div className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin border-2 border-primary border-t-transparent rounded-full" />
          <p className="text-sm text-muted-foreground">Esperando foto…</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1" />
            Reintentar
          </Button>
        </div>
      )}

      {/* Preview — confirm or retake */}
      {mode === 'preview' && preview && (
        <>
          <div className="rounded-xl overflow-hidden border border-border bg-muted/20">
            <img src={preview} alt="Foto capturada" className="w-full aspect-[4/3] object-cover" />
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleRetake}
              className="flex-1 h-12 rounded-xl"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Repetir
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className="flex-1 h-12 rounded-xl"
            >
              <Check className="h-4 w-4 mr-2" />
              Usar foto
            </Button>
          </div>
        </>
      )}

      {/* Close button — always visible */}
      {mode !== 'preview' && (
        <Button type="button" variant="outline" onClick={() => { stopCamera(); onClose(); }} className="w-full h-10 rounded-xl">
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
      )}
    </div>
  );
}
