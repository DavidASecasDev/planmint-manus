import { useRef, useState, useCallback, useEffect, forwardRef } from 'react';
import { Camera, RotateCcw, Check, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'PlateCamera' });

interface PlateCameraProps {
  onCapture: (imageBase64: string) => void;
  onBeforeOpen?: () => void;
  onFileSelected?: (imageBase64: string) => void;
  restoredPreview?: string | null;
  isProcessing?: boolean;
}

/**
 * Compresses a video frame or image element to a JPEG base64 ≤ 800px wide.
 */
function compressToJpeg(source: HTMLVideoElement | HTMLImageElement, maxWidth = 800, quality = 0.7): string {
  const canvas = document.createElement('canvas');
  const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  const scale = Math.min(1, maxWidth / sw);
  canvas.width = sw * scale;
  canvas.height = sh * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

export const PlateCamera = forwardRef<HTMLDivElement, PlateCameraProps>(
  function PlateCamera({ onCapture, onBeforeOpen, onFileSelected, restoredPreview, isProcessing }, ref) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [preview, setPreview] = useState<string | null>(restoredPreview ?? null);
    const [cameraMode, setCameraMode] = useState<'idle' | 'streaming' | 'fallback'>('idle');
    const [cameraError, setCameraError] = useState(false);
    const [videoReady, setVideoReady] = useState(false);

    // Sync restored preview from parent
    useEffect(() => {
      if (restoredPreview && !preview) {
        setPreview(restoredPreview);
        log.debug('Preview restored from parent');
      }
    }, [restoredPreview]);

    // Cleanup stream on unmount
    useEffect(() => {
      return () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };
    }, []);

    // ── KEY FIX: Bind stream to video element when both are ready ──
    // This useEffect fires after React renders the <video> element
    // (when cameraMode === 'streaming'), ensuring videoRef.current is available.
    useEffect(() => {
      if (cameraMode !== 'streaming') {
        setVideoReady(false);
        return;
      }

      const video = videoRef.current;
      const stream = streamRef.current;

      if (!video || !stream) {
        log.warn('Video element or stream not available yet');
        return;
      }

      // Assign the stream to the video element
      video.srcObject = stream;

      const handleCanPlay = () => {
        log.debug('Video canplay event fired');
        setVideoReady(true);
      };

      const handlePlaying = () => {
        log.debug('Video playing event fired');
        setVideoReady(true);
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('playing', handlePlaying);

      // Attempt to play
      video.play().then(() => {
        log.debug('Video play() resolved');
        setVideoReady(true);
      }).catch((err) => {
        log.warn('Video play() rejected:', err);
        // On some browsers, autoplay may be blocked; the user can still
        // interact with the video to start it
      });

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('playing', handlePlaying);
      };
    }, [cameraMode]);

    // Start embedded camera
    const startCamera = useCallback(async () => {
      log.debug('Starting getUserMedia camera');
      try {
        // Stop any existing stream first
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        log.debug('getUserMedia stream obtained, tracks:', stream.getVideoTracks().length);
        streamRef.current = stream;
        setVideoReady(false);
        // Setting cameraMode to 'streaming' will render the <video> element,
        // and the useEffect above will bind the stream to it.
        setCameraMode('streaming');
      } catch (err) {
        log.warn('getUserMedia failed, falling back to native input', err);
        setCameraError(true);
        setCameraMode('fallback');
        openNativeInput();
      }
    }, []);

    const stopCamera = useCallback(() => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setVideoReady(false);
      setCameraMode('idle');
    }, []);

    // Capture from embedded stream
    const captureFromStream = useCallback(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) {
        log.warn('Cannot capture: video not ready (videoWidth=0)');
        // Fallback: try native input
        openNativeInput();
        return;
      }
      const base64 = compressToJpeg(video);
      log.debug('Captured from stream');
      setPreview(base64);
      onFileSelected?.(base64);
      stopCamera();
    }, [onFileSelected, stopCamera]);

    // Native file input fallback
    const openNativeInput = useCallback(() => {
      onBeforeOpen?.();
      fileInputRef.current?.click();
    }, [onBeforeOpen]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      try {
        const file = e.target.files?.[0];
        if (!file) {
          log.debug('No file selected (user cancelled)');
          // Reset to idle if no file was selected
          if (cameraMode === 'fallback') setCameraMode('idle');
          return;
        }
        log.debug('File selected:', file.name, file.size);
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const raw = reader.result as string;
            if (!raw) return;
            // Compress before storing
            const img = new Image();
            img.onload = () => {
              const compressed = compressToJpeg(img);
              log.debug('Compressed image ready');
              setPreview(compressed);
              onFileSelected?.(compressed);
            };
            img.onerror = () => {
              // Fallback: use raw (might be large)
              setPreview(raw);
              onFileSelected?.(raw);
            };
            img.src = raw;
          } catch (err) {
            log.error('FileReader result error:', err);
          }
        };
        reader.onerror = () => log.error('FileReader error:', reader.error);
        reader.readAsDataURL(file);
      } catch (err) {
        log.error('handleFileChange error:', err);
      } finally {
        if (e.target) e.target.value = '';
      }
    }, [onFileSelected, cameraMode]);

    const handleConfirm = useCallback(() => {
      if (preview) {
        log.debug('User confirmed photo');
        onCapture(preview);
      }
    }, [preview, onCapture]);

    const handleRetake = useCallback(() => {
      setPreview(null);
      setCameraMode('idle');
    }, []);

    const handleStartCapture = useCallback(() => {
      // Try embedded camera first on all platforms
      if (typeof navigator.mediaDevices?.getUserMedia === 'function' && !cameraError) {
        startCamera();
      } else {
        setCameraMode('fallback');
        openNativeInput();
      }
    }, [startCamera, openNativeInput, cameraError]);

    return (
      <div ref={ref} className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Idle: show capture button */}
        {!preview && cameraMode === 'idle' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleStartCapture}
              disabled={isProcessing}
              className="w-full aspect-[16/10] rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 flex flex-col items-center justify-center gap-3 transition-colors hover:border-primary/50 hover:bg-muted/50 active:scale-[0.98] disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Tomar foto de la matrícula</p>
                <p className="text-xs text-muted-foreground mt-0.5">Pulsa para abrir la cámara</p>
              </div>
            </button>
            {/* Always show native fallback option */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => { setCameraMode('fallback'); openNativeInput(); }}
            >
              <Upload className="h-3 w-3 mr-1" />
              Subir desde galería
            </Button>
          </div>
        )}

        {/* Streaming: embedded camera view */}
        {!preview && cameraMode === 'streaming' && (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden border border-border bg-black relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[16/10] object-cover"
                style={{ minHeight: '200px' }}
              />
              {/* Loading overlay while video initializes */}
              {!videoReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
                  <div className="h-8 w-8 animate-spin border-2 border-white border-t-transparent rounded-full" />
                  <p className="text-sm text-white/80">Iniciando cámara…</p>
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={captureFromStream}
                  disabled={!videoReady}
                  className="w-16 h-16 rounded-full bg-white border-4 border-white/50 shadow-lg active:scale-90 transition-transform disabled:opacity-50"
                  aria-label="Capturar foto"
                />
              </div>
              {/* Fallback button if camera takes too long */}
              <div className="absolute top-3 right-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10 text-xs"
                  onClick={() => {
                    stopCamera();
                    setCameraMode('fallback');
                    openNativeInput();
                  }}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Galería
                </Button>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => { stopCamera(); }} className="w-full h-10">
              Cancelar
            </Button>
          </div>
        )}

        {/* Fallback mode waiting for native input (hidden input already triggered) */}
        {!preview && cameraMode === 'fallback' && (
          <div className="space-y-3">
            <div className="w-full aspect-[16/10] rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin border-2 border-primary border-t-transparent rounded-full" />
              <p className="text-sm text-muted-foreground">Esperando foto…</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setCameraMode('idle')} className="w-full h-10">
              Cancelar
            </Button>
          </div>
        )}

        {/* Preview: show captured photo */}
        {preview && (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden border border-border bg-muted/20">
              <img
                src={preview}
                alt="Foto capturada"
                className="w-full aspect-[16/10] object-cover"
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleRetake}
                disabled={isProcessing}
                className="flex-1 h-12"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Repetir
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={isProcessing}
                className="flex-1 h-12"
              >
                {isProcessing ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full" />
                    Leyendo…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Usar foto
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
);
