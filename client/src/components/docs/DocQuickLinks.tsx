import { FileDown, Github, Database, Zap, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocQuickLinksProps {
  onDownloadPdf: () => void;
  isGeneratingPdf: boolean;
}

export function DocQuickLinks({ onDownloadPdf, isGeneratingPdf }: DocQuickLinksProps) {
  const links = [
    {
      icon: FileDown,
      label: 'Descargar PDF',
      onClick: onDownloadPdf,
      isAction: true,
    },
    {
      icon: Database,
      label: 'Ver esquema DB',
      href: '#database',
      isAction: false,
    },
    {
      icon: Zap,
      label: 'Edge Functions',
      href: '#edge-functions',
      isAction: false,
    },
  ];

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
        Acciones Rápidas
      </h3>
      
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 h-9"
        onClick={onDownloadPdf}
        disabled={isGeneratingPdf}
      >
        <FileDown className="h-4 w-4" />
        {isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}
      </Button>

      <div className="pt-3 border-t border-border/50">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
          Enlaces Externos
        </h3>
        
        <div className="space-y-1">
          <a
            href="https://supabase.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
          >
            <Database className="h-4 w-4" />
            <span>Docs Supabase</span>
            <ExternalLink className="h-3 w-3 ml-auto" />
          </a>
          
          <a
            href="https://stripe.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
          >
            <Zap className="h-4 w-4" />
            <span>Docs Stripe</span>
            <ExternalLink className="h-3 w-3 ml-auto" />
          </a>
          
          <a
            href="https://ui.shadcn.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
          >
            <Github className="h-4 w-4" />
            <span>shadcn/ui</span>
            <ExternalLink className="h-3 w-3 ml-auto" />
          </a>
        </div>
      </div>
    </div>
  );
}
