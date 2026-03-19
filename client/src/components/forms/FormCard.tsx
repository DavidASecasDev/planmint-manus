import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form } from "@/types/forms";
import { 
  FileText, 
  ExternalLink, 
  Settings, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Copy,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface FormCardProps {
  form: Form;
  onEdit: (form: Form) => void;
  onDelete: (form: Form) => void;
  onToggleActive: (form: Form) => void;
  onViewResponses: (form: Form) => void;
  onCopyLink: (form: Form) => void;
}

export function FormCard({ 
  form, 
  onEdit, 
  onDelete, 
  onToggleActive,
  onViewResponses,
  onCopyLink 
}: FormCardProps) {
  const publicUrl = `${window.location.origin}/f/${form.slug}`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-base truncate">{form.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={form.is_active ? "default" : "secondary"}>
              {form.is_active ? "Activo" : "Inactivo"}
            </Badge>
            {form.is_public && (
              <Badge variant="outline">Público</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {form.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {form.description}
          </p>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{form.response_count} respuestas</span>
          <span>
            {format(new Date(form.created_at), "d MMM yyyy", { locale: es })}
          </span>
        </div>

        {form.is_public && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <code className="text-xs truncate flex-1">/f/{form.slug}</code>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => onCopyLink(form)}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              asChild
            >
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => onEdit(form)}
          >
            <Settings className="h-4 w-4 mr-1" />
            Editar
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onViewResponses(form)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Respuestas
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleActive(form)}
          >
            {form.is_active ? (
              <ToggleRight className="h-4 w-4 text-primary" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(form)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
