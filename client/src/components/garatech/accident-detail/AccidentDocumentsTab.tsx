import { useState, useRef } from 'react';
import { useAccidentFiles } from '@/hooks/useAccidentFiles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, Trash2, FileText, Download } from 'lucide-react';
import { ACCIDENT_FILE_CATEGORY_LABELS, type AccidentFileCategory } from '@/types/garatech';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  accidentId: string;
  canManage: boolean;
}

const DOC_CATEGORIES: AccidentFileCategory[] = ['police_report', 'insurance_form', 'friendly_report', 'invoice', 'other'];

export function AccidentDocumentsTab({ accidentId, canManage }: Props) {
  const { documents, isLoading, uploadFile, deleteFile, getSignedUrl } = useAccidentFiles(accidentId);
  const [category, setCategory] = useState<AccidentFileCategory>('police_report');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadFile.mutateAsync({ file, fileType: 'document', fileCategory: category });
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDownload = async (doc: typeof documents[0]) => {
    try {
      const url = await getSignedUrl(doc.storage_path);
      window.open(url, '_blank');
    } catch {}
  };

  if (isLoading) return <Skeleton className="h-48 w-full mt-4" />;

  return (
    <div className="space-y-4 mt-4">
      {canManage && (
        <div className="flex items-center gap-3">
          <Select value={category} onValueChange={(v) => setCategory(v as AccidentFileCategory)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{ACCIDENT_FILE_CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Subir documento
          </Button>
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
        </div>
      )}

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay documentos adjuntos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ACCIDENT_FILE_CATEGORY_LABELS[doc.file_category as AccidentFileCategory] || doc.file_category}
                    {' · '}
                    {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: es })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteFile.mutate(doc)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
