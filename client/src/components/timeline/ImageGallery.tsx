import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { TaskUpdateImage } from '@/types/updates';
import { cn } from '@/lib/utils';

interface ImageGalleryProps {
  images: TaskUpdateImage[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const getPublicUrl = (storagePath: string) => {
    const { data } = supabase.storage
      .from('task-update-images')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const goToPrevious = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex(lightboxIndex === 0 ? images.length - 1 : lightboxIndex - 1);
    }
  };

  const goToNext = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex(lightboxIndex === images.length - 1 ? 0 : lightboxIndex + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
    if (e.key === 'Escape') closeLightbox();
  };

  const downloadImage = async (image: TaskUpdateImage) => {
    const url = getPublicUrl(image.storage_path);
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = image.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <>
      {/* Thumbnail grid */}
      <div className="flex flex-wrap gap-2 mt-2">
        {images.map((image, index) => (
          <button
            key={image.id}
            onClick={() => openLightbox(index)}
            className="relative group overflow-hidden rounded-lg border border-border hover:border-primary/50 transition-colors"
          >
            <img
              src={getPublicUrl(image.storage_path)}
              alt={image.file_name}
              loading="lazy"
              className="h-20 w-20 object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          </button>
        ))}
      </div>

      {/* Lightbox modal */}
      <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && closeLightbox()}>
        <DialogContent 
          className="max-w-4xl w-full p-0 bg-black/95 border-none overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          {lightboxIndex !== null && (
            <div className="relative flex flex-col items-center">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={closeLightbox}
                className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Download button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => downloadImage(images[lightboxIndex])}
                className="absolute top-2 right-12 z-10 text-white hover:bg-white/20"
              >
                <Download className="h-5 w-5" />
              </Button>

              {/* Navigation buttons */}
              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToPrevious}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}

              {/* Main image */}
              <div className="flex items-center justify-center min-h-[60vh] max-h-[80vh] w-full p-4">
                <img
                  src={getPublicUrl(images[lightboxIndex].storage_path)}
                  alt={images[lightboxIndex].file_name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              {/* Image info and counter */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between text-white text-sm">
                  <span className="truncate max-w-[60%]">
                    {images[lightboxIndex].file_name}
                  </span>
                  <span className="opacity-70">
                    {lightboxIndex + 1} / {images.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
