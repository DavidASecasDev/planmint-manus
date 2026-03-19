import { useRef, useState, useCallback } from 'react';
import { ImagePlus, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface ImageUploadPreviewProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

export function ImageUploadPreview({ files, onFilesChange, disabled }: ImageUploadPreviewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const validateAndAddFiles = useCallback((newFiles: FileList | File[]) => {
    setError(null);
    const validFiles: File[] = [];
    const fileArray = Array.from(newFiles);

    for (const file of fileArray) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`Tipo de archivo no permitido: ${file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`Archivo muy grande (máx 5MB): ${file.name}`);
        continue;
      }
      if (files.length + validFiles.length >= MAX_FILES) {
        setError(`Máximo ${MAX_FILES} imágenes por actualización`);
        break;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onFilesChange([...files, ...validFiles]);
    }
  }, [files, onFilesChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  }, [validateAndAddFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
    setError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      {/* Drop zone / Add button */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-lg p-3 transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        {files.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="w-full flex flex-col items-center gap-2 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="text-sm">Añadir fotos (arrastrar o click)</span>
          </button>
        ) : (
          <div className="space-y-3">
            {/* Preview grid */}
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <div key={index} className="relative group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-16 w-16 object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded-b-lg truncate">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              ))}
              
              {/* Add more button */}
              {files.length < MAX_FILES && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled}
                  className="h-16 w-16 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {files.length} de {MAX_FILES} imágenes
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}
