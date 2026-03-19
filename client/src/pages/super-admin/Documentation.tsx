import { useState, useMemo } from 'react';
import { 
  Search, Boxes, Database, Shield, Puzzle, Zap, Link, Lock, ChevronDown,
  Code, Layers, FolderTree, Table, UserCog, Users, FolderLock, ToggleLeft,
  Plus, Layout, List, FileCode, CreditCard, Car, Bell, ShieldCheck, Ban, Crown,
  Clock, FileDown
} from 'lucide-react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { technicalDocs, DocSection, DocSubsection } from '@/data/technicalDocs';
import { HelpCallout, CalloutType } from '@/components/help/HelpCallout';
import { HelpDifficultyBadge } from '@/components/help/HelpDifficultyBadge';
import { HelpBreadcrumb } from '@/components/help/HelpBreadcrumb';
import { DocQuickLinks } from '@/components/docs/DocQuickLinks';
import { usePdfExport } from '@/hooks/usePdfExport';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Boxes, Database, Shield, Puzzle, Zap, Link, Lock, Code, Layers, FolderTree,
  Table, UserCog, Users, FolderLock, ToggleLeft, Plus, Layout, List, FileCode,
  CreditCard, Car, Bell, ShieldCheck, Ban, Crown,
};

function DocSubsectionComponent({ 
  subsection, 
  isOpen, 
  onToggle 
}: { 
  subsection: DocSubsection; 
  isOpen: boolean; 
  onToggle: () => void;
}) {
  const renderContent = (content: string) => {
    const lines = content.trim().split('\n');
    const elements: JSX.Element[] = [];
    let inTable = false;
    let tableRows: string[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let inCallout = false;
    let calloutType: CalloutType = 'info';
    let calloutContent: string[] = [];

    const flushTable = () => {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const dataRows = tableRows.slice(2);
        const headers = headerRow.split('|').filter(Boolean).map(h => h.trim());
        
        elements.push(
          <div key={`table-${elements.length}`} className="my-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  {headers.map((header, i) => (
                    <th key={i} className="px-4 py-3 text-left font-semibold text-foreground border-b border-border">
                      {header.replace(/`/g, '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rowIndex) => {
                  const cells = row.split('|').filter(Boolean).map(c => c.trim());
                  return (
                    <tr key={rowIndex} className="hover:bg-muted/30 transition-colors">
                      {cells.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-2.5 text-muted-foreground border-b border-border/50">
                          <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">
                            {cell.replace(/`/g, '')}
                          </code>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
    };

    const flushCode = () => {
      if (codeContent.length > 0) {
        elements.push(
          <pre key={`code-${elements.length}`} className="my-4 p-4 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto border border-slate-700">
            <code className="text-sm font-mono">
              {codeContent.join('\n')}
            </code>
          </pre>
        );
        codeContent = [];
      }
    };

    const flushCallout = () => {
      if (calloutContent.length > 0) {
        elements.push(
          <HelpCallout 
            key={`callout-${elements.length}`} 
            type={calloutType}
          >
            {calloutContent.join('\n')}
          </HelpCallout>
        );
        calloutContent = [];
      }
    };

    lines.forEach((line, index) => {
      // Handle callout blocks
      if (line.trim().match(/^:::(tip|warning|info|code|api|security|admin)$/)) {
        flushTable();
        flushCode();
        inCallout = true;
        const match = line.trim().match(/^:::(tip|warning|info|code|api|security|admin)$/);
        if (match) {
          const typeMap: Record<string, CalloutType> = {
            tip: 'tip',
            warning: 'warning',
            info: 'info',
            code: 'info',
            api: 'info',
            security: 'warning',
            admin: 'admin',
          };
          calloutType = typeMap[match[1]] || 'info';
        }
        return;
      }

      if (line.trim() === ':::' && inCallout) {
        flushCallout();
        inCallout = false;
        return;
      }

      if (inCallout) {
        calloutContent.push(line);
        return;
      }

      // Handle code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          flushCode();
          inCodeBlock = false;
        } else {
          flushTable();
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      // Handle tables
      if (line.startsWith('|')) {
        if (!inTable) {
          inTable = true;
        }
        tableRows.push(line);
        return;
      } else if (inTable) {
        flushTable();
        inTable = false;
      }

      // Headers
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-xl font-bold text-foreground mt-6 mb-3 flex items-center gap-2">
            {line.slice(3)}
          </h2>
        );
        return;
      }

      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-lg font-semibold text-foreground mt-5 mb-2">
            {line.slice(4)}
          </h3>
        );
        return;
      }

      if (line.trim() === '') return;

      // Lists
      if (line.trim().startsWith('- ')) {
        const content = line.trim().slice(2);
        elements.push(
          <li key={index} className="text-muted-foreground ml-4 mb-1.5 list-disc list-inside">
            {renderInlineStyles(content)}
          </li>
        );
        return;
      }

      if (/^\d+\.\s/.test(line.trim())) {
        const content = line.trim().replace(/^\d+\.\s/, '');
        elements.push(
          <li key={index} className="text-muted-foreground ml-4 mb-1.5 list-decimal list-inside">
            {renderInlineStyles(content)}
          </li>
        );
        return;
      }

      // Paragraphs
      elements.push(
        <p key={index} className="text-muted-foreground mb-3 leading-relaxed">
          {renderInlineStyles(line)}
        </p>
      );
    });

    flushTable();
    flushCode();
    flushCallout();

    return elements;
  };

  const renderInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      const codeParts = part.split(/(`[^`]+`)/g);
      return codeParts.map((codePart, j) => {
        if (codePart.startsWith('`') && codePart.endsWith('`')) {
          return (
            <code key={`${i}-${j}`} className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-primary">
              {codePart.slice(1, -1)}
            </code>
          );
        }
        return codePart;
      });
    });
  };

  const SubIcon = subsection.icon ? iconMap[subsection.icon] : null;

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 rounded-lg transition-colors group">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {SubIcon && (
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <SubIcon className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="font-medium text-foreground block truncate">{subsection.title}</span>
            <div className="flex items-center gap-2 mt-1">
              {subsection.difficulty && (
                <HelpDifficultyBadge difficulty={subsection.difficulty} />
              )}
              {subsection.readTime && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {subsection.readTime} min
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform shrink-0 ml-2',
            isOpen && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <div className="pt-3 pl-11 border-l-2 border-primary/20 ml-4">
          {renderContent(subsection.content)}
          
          {subsection.tags && subsection.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-border/50">
              {subsection.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function Documentation() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string>(technicalDocs[0]?.id || '');
  const [openSubsections, setOpenSubsections] = useState<Record<string, boolean>>({});
  const [activeSubsection, setActiveSubsection] = useState<string | null>(null);

  const { generatePdf, isGenerating } = usePdfExport({
    title: 'Documentación Técnica',
    subtitle: 'PlanMint - Referencia para desarrolladores',
    filename: 'PlanMint_Documentacion_Tecnica',
  });

  const searchFilteredSections = useMemo(() => {
    if (!searchQuery.trim()) return technicalDocs;

    const query = searchQuery.toLowerCase();
    return technicalDocs
      .map((section) => ({
        ...section,
        subsections: section.subsections.filter(
          (sub) =>
            sub.title.toLowerCase().includes(query) ||
            sub.content.toLowerCase().includes(query) ||
            sub.tags?.some(tag => tag.toLowerCase().includes(query))
        ),
      }))
      .filter((section) => section.subsections.length > 0);
  }, [searchQuery]);

  const totalResults = useMemo(() => {
    return searchFilteredSections.reduce((acc, s) => acc + s.subsections.length, 0);
  }, [searchFilteredSections]);

  const currentSection = searchFilteredSections.find((s) => s.id === activeSection) || searchFilteredSections[0];

  const toggleSubsection = (subsectionId: string) => {
    setOpenSubsections((prev) => ({
      ...prev,
      [subsectionId]: !prev[subsectionId],
    }));
    setActiveSubsection(subsectionId);
  };

  const handleDownloadPdf = async () => {
    try {
      await generatePdf(technicalDocs);
      toast.success('PDF generado correctamente');
    } catch (error) {
      toast.error('Error al generar el PDF');
    }
  };

  const breadcrumbItems = [
    { label: 'Super Admin', href: '/super-admin' },
    { label: 'Documentación' },
    ...(currentSection ? [{ label: currentSection.title }] : []),
  ];

  return (
    <SuperAdminLayout title="Documentación Técnica">
      <div className="space-y-6">
        {/* Header with gradient */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-primary/20 p-6 md:p-8">
          <div className="absolute inset-0 bg-grid-white/5" />
          <div className="relative">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Code className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white">
                    Documentación Técnica
                  </h1>
                  <p className="text-slate-300 mt-1">
                    Referencia técnica para desarrolladores
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleDownloadPdf} 
                disabled={isGenerating}
                className="shrink-0"
              >
                <FileDown className="h-4 w-4 mr-2" />
                {isGenerating ? 'Generando...' : 'Descargar PDF'}
              </Button>
            </div>
            
            {/* Search bar */}
            <div className="mt-6 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Buscar en la documentación..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:bg-white/20"
                />
                {searchQuery && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    {totalResults} resultados
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Breadcrumb */}
        <HelpBreadcrumb items={breadcrumbItems} />

        {/* Main content */}
        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <div className="w-72 shrink-0 hidden lg:block">
            <div className="sticky top-6 space-y-6">
              <Card>
                <div className="p-4 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">Secciones</h2>
                </div>
                <ScrollArea className="h-[400px]">
                  <nav className="p-3 space-y-1">
                    {searchFilteredSections.map((section) => {
                      const Icon = iconMap[section.icon] || Boxes;
                      const isActive = activeSection === section.id;
                      return (
                        <button
                          key={section.id}
                          onClick={() => setActiveSection(section.id)}
                          className={cn(
                            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate flex-1 text-left">{section.title}</span>
                          <Badge 
                            variant={isActive ? "secondary" : "outline"} 
                            className={cn(
                              "h-5 min-w-[20px] justify-center text-xs",
                              isActive && "bg-primary-foreground/20 text-primary-foreground border-0"
                            )}
                          >
                            {section.subsections.length}
                          </Badge>
                        </button>
                      );
                    })}
                  </nav>
                </ScrollArea>
              </Card>

              <Card className="p-4">
                <DocQuickLinks 
                  onDownloadPdf={handleDownloadPdf}
                  isGeneratingPdf={isGenerating}
                />
              </Card>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {currentSection ? (
              <Card className="overflow-hidden">
                {/* Section header */}
                <div className="bg-gradient-to-r from-muted/50 to-muted/30 p-6 border-b border-border">
                  <div className="flex items-center gap-4">
                    {(() => {
                      const Icon = iconMap[currentSection.icon] || Boxes;
                      return (
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                      );
                    })()}
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        {currentSection.title}
                      </h2>
                      {currentSection.description && (
                        <p className="text-muted-foreground mt-1">
                          {currentSection.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <CardContent className="p-4 space-y-2">
                  {currentSection.subsections.map((subsection) => (
                    <DocSubsectionComponent
                      key={subsection.id}
                      subsection={subsection}
                      isOpen={openSubsections[subsection.id] || false}
                      onToggle={() => toggleSubsection(subsection.id)}
                    />
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Boxes className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-lg font-semibold text-foreground mb-2">
                    No se encontraron resultados
                  </h2>
                  <p className="text-muted-foreground">
                    Intenta con otros términos de búsqueda
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
