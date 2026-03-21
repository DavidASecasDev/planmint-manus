import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, Image as ImageIcon, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useRepairPhotos } from '@/hooks/useRepairPhotos';
import type { RepairPhotoType, RepairPhoto } from '@/types/garatech';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RepairPhotosTabProps {
  repairId: string;
}

export function RepairPhotosTab({ repairId }: RepairPhotosTabProps) {
  const { beforePhotos, afterPhotos, isLoading, uploadPhoto, deletePhoto, getSignedUrl } = useRepairPhotos(repairId);
  const [selectedPhoto, setSelectedPhoto] = useState<RepairPhoto | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  // Load signed URLs for all photos
  useEffect(() => {
    const loadUrls = async () => {
      const allPhotos = [...beforePhotos, ...afterPhotos];
      const urls: Record<string, string> = {};
      
      for (const photo of allPhotos) {
        if (!photoUrls[photo.id]) {
          try {
            const url = await getSignedUrl(photo.storage_path);
            urls[photo.id] = url;
          } catch (error) {
            console.error('Error getting signed URL:', error);
          }
        }
      }
      
      if (Object.keys(urls).length > 0) {
        setPhotoUrls(prev => ({ ...prev, ...urls }));
      }
    };
    
    if (!isLoading) {
      loadUrls();
    }
  }, [beforePhotos, afterPhotos, isLoading, getSignedUrl]);

  const handleFileSelect = async (files: FileList | null, photoType: RepairPhotoType) => {
    if (!files?.length) return;
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      await uploadPhoto.mutateAsync({ file, photoType });
    }
  };

  const handleViewPhoto = async (photo: RepairPhoto) => {
    let url = photoUrls[photo.id];
    if (!url) {
      url = await getSignedUrl(photo.storage_path);
      setPhotoUrls(prev => ({ ...prev, [photo.id]: url }));
    }
    setSelectedUrl(url);
    setSelectedPhoto(photo);
  };

  const PhotoGrid = ({ 
    photos, 
    type, 
    title, 
    inputRef 
  }: { 
    photos: RepairPhoto[]; 
    type: RepairPhotoType; 
    title: string;
    inputRef: React.RefObject<HTMLInputElement>;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {title}
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => inputRef.current?.click()}
            disabled={uploadPhoto.isPending}
          >
            <Upload className="h-4 w-4 mr-1" />
            Subir
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files, type)}
        />
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay fotos</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group aspect-square">
                {photoUrls[photo.id] ? (
                  <img
                    src={photoUrls[photo.id]}
                    alt={photo.file_name || 'Foto'}
                    className="w-full h-full object-cover rounded-lg cursor-pointer"
                    onClick={() => handleViewPhoto(photo)}
                  />
                ) : (
                  <Skeleton className="w-full h-full rounded-lg" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                    onClick={() => handleViewPhoto(photo)}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:text-destructive hover:bg-white/20"
                    onClick={() => deletePhoto.mutateAsync(photo)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(j => (
                  <Skeleton key={j} className="aspect-square rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PhotoGrid 
        photos={beforePhotos} 
        type="before" 
        title="Antes de Reparar" 
        inputRef={beforeInputRef}
      />
      <PhotoGrid 
        photos={afterPhotos} 
        type="after" 
        title="Después de Reparar" 
        inputRef={afterInputRef}
      />

      {/* Photo Preview Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <VisuallyHidden><DialogTitle>Vista previa de foto</DialogTitle></VisuallyHidden>
          {selectedUrl && (
            <div className="relative">
              <img
                src={selectedUrl}
                alt={selectedPhoto?.file_name || 'Foto'}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              {selectedPhoto && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                  <p className="font-medium">
                    {selectedPhoto.photo_type === 'before' ? 'Antes' : 'Después'}
                  </p>
                  <p className="text-sm opacity-75">
                    {format(new Date(selectedPhoto.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
