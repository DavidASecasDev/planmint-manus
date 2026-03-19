import { useState, useRef, useEffect } from 'react';
import { useAccidentFiles } from '@/hooks/useAccidentFiles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, Trash2, ImageIcon } from 'lucide-react';
import { ACCIDENT_FILE_CATEGORY_LABELS, type AccidentFileCategory } from '@/types/garatech';

interface Props {
  accidentId: string;
  canManage: boolean;
}

const PHOTO_CATEGORIES: AccidentFileCategory[] = ['scene', 'damage', 'other'];

export function AccidentPhotosTab({ accidentId, canManage }: Props) {
  const { photos, isLoading, uploadFile, deleteFile, getSignedUrl } = useAccidentFiles(accidentId);
  const [category, setCategory] = useState<AccidentFileCategory>('scene');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    photos.forEach(async (p) => {
      if (!urls[p.id]) {
        try {
          const url = await getSignedUrl(p.storage_path);
          setUrls(prev => ({ ...prev, [p.id]: url }));
        } catch {}
      }
    });
  }, [photos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadFile.mutateAsync({ file, fileType: 'photo', fileCategory: category });
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  if (isLoading) return <Skeleton className="h-48 w-full mt-4" />;

  return (
    <div className="space-y-4 mt-4">
      {canManage && (
        <div className="flex items-center gap-3">
          <Select value={category} onValueChange={(v) => setCategory(v as AccidentFileCategory)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PHOTO_CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{ACCIDENT_FILE_CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Subir fotos
          </Button>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        </div>
      )}

      {photos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay fotos del accidente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <Card key={photo.id} className="overflow-hidden group relative">
              <div className="aspect-square bg-muted flex items-center justify-center">
                {urls[photo.id] ? (
                  <img src={urls[photo.id]} alt={photo.file_name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <CardContent className="p-2">
                <p className="text-xs font-medium truncate">{photo.file_name}</p>
                <p className="text-xs text-muted-foreground">{ACCIDENT_FILE_CATEGORY_LABELS[photo.file_category as AccidentFileCategory] || photo.file_category}</p>
              </CardContent>
              {canManage && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteFile.mutate(photo)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
