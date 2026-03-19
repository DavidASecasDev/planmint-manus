import { useFormResponses } from "@/hooks/useForms";
import { Form, FormResponse } from "@/types/forms";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Eye, CheckCircle, Archive, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FormResponsesDialogProps {
  form: Form | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  new: { label: "Nueva", variant: "default" },
  reviewed: { label: "Revisada", variant: "secondary" },
  processed: { label: "Procesada", variant: "outline" },
  archived: { label: "Archivada", variant: "outline" },
};

export function FormResponsesDialog({ form, open, onOpenChange }: FormResponsesDialogProps) {
  const { responses, isLoading, updateStatus } = useFormResponses(form?.id || null);

  const handleStatusChange = async (response: FormResponse, newStatus: string) => {
    await updateStatus({ id: response.id, status: newStatus });
  };

  const handleExportCSV = () => {
    if (!responses || responses.length === 0) return;

    const headers = Object.keys(responses[0].data);
    const csvContent = [
      ['ID', 'Estado', 'Email', 'Nombre', 'Fecha', ...headers].join(','),
      ...responses.map(r => [
        r.id,
        r.status,
        r.submitter_email || '',
        r.submitter_name || '',
        format(new Date(r.created_at), 'yyyy-MM-dd HH:mm'),
        ...headers.map(h => JSON.stringify(r.data[h] || '')),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${form?.slug || 'form'}-responses.csv`;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Respuestas: {form?.name}</DialogTitle>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!responses?.length}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !responses || responses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Eye className="h-12 w-12 mb-4 opacity-50" />
              <p>Aún no hay respuestas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Datos</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map((response) => (
                  <TableRow key={response.id}>
                    <TableCell>
                      <Badge variant={STATUS_LABELS[response.status]?.variant || "secondary"}>
                        {STATUS_LABELS[response.status]?.label || response.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(response.created_at), "d MMM yyyy HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{response.submitter_name || '-'}</p>
                        <p className="text-sm text-muted-foreground">{response.submitter_email || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-24">
                        {JSON.stringify(response.data, null, 2)}
                      </pre>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {response.status === 'new' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusChange(response, 'reviewed')}
                            title="Marcar como revisada"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {response.status !== 'archived' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusChange(response, 'archived')}
                            title="Archivar"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
