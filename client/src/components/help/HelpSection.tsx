import { ChevronDown } from 'lucide-react';
import * as Icons from 'lucide-react';
import { HelpSubsection } from '@/data/helpContent';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { HelpCallout, CalloutType } from './HelpCallout';
import { HelpDifficultyBadge } from './HelpDifficultyBadge';

interface HelpSectionProps {
  subsection: HelpSubsection;
  isOpen: boolean;
  onToggle: () => void;
}

export function HelpSection({ subsection, isOpen, onToggle }: HelpSectionProps) {
  // Get the icon component
  const IconComponent = subsection.icon 
    ? (Icons[subsection.icon as keyof typeof Icons] as React.ComponentType<{ className?: string }>) 
    : null;

  // Parse and render content with callouts
  const renderContent = (content: string) => {
    const lines = content.trim().split('\n');
    const elements: JSX.Element[] = [];
    let inTable = false;
    let tableRows: string[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let inCallout = false;
    let calloutType: CalloutType = 'tip';
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
                      {header.replace(/\*\*/g, '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rowIndex) => {
                  const cells = row.split('|').filter(Boolean).map(c => c.trim());
                  return (
                    <tr key={rowIndex} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      {cells.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-3 text-muted-foreground">
                          {renderInlineStyles(cell.replace(/\*\*/g, ''))}
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
          <pre key={`code-${elements.length}`} className="my-4 p-4 bg-muted rounded-lg overflow-x-auto border border-border">
            <code className="text-sm font-mono text-foreground">
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
          <HelpCallout key={`callout-${elements.length}`} type={calloutType}>
            {calloutContent.map((line, i) => (
              <span key={i}>
                {renderInlineStyles(line)}
                {i < calloutContent.length - 1 && <br />}
              </span>
            ))}
          </HelpCallout>
        );
        calloutContent = [];
      }
    };

    lines.forEach((line, index) => {
      // Callout blocks
      if (line.startsWith(':::tip')) {
        flushTable();
        flushCode();
        inCallout = true;
        calloutType = 'tip';
        return;
      }
      if (line.startsWith(':::warning')) {
        flushTable();
        flushCode();
        inCallout = true;
        calloutType = 'warning';
        return;
      }
      if (line.startsWith(':::info')) {
        flushTable();
        flushCode();
        inCallout = true;
        calloutType = 'info';
        return;
      }
      if (line.startsWith(':::admin')) {
        flushTable();
        flushCode();
        inCallout = true;
        calloutType = 'admin';
        return;
      }
      if (line.startsWith(':::') && inCallout) {
        flushCallout();
        inCallout = false;
        return;
      }

      if (inCallout) {
        if (line.trim()) {
          calloutContent.push(line);
        }
        return;
      }

      // Code blocks
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

      // Tables
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
          <h2 key={index} className="text-xl font-bold text-foreground mt-6 mb-3 first:mt-0">
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

      // Empty lines
      if (line.trim() === '') {
        return;
      }

      // List items
      if (line.trim().startsWith('- ')) {
        const content = line.trim().slice(2);
        elements.push(
          <li key={index} className="text-muted-foreground ml-4 mb-1.5 list-disc list-inside marker:text-primary/60">
            {renderInlineStyles(content)}
          </li>
        );
        return;
      }

      // Numbered lists
      if (/^\d+\.\s/.test(line.trim())) {
        const content = line.trim().replace(/^\d+\.\s/, '');
        elements.push(
          <li key={index} className="text-muted-foreground ml-4 mb-1.5 list-decimal list-inside marker:text-primary marker:font-semibold">
            {renderInlineStyles(content)}
          </li>
        );
        return;
      }

      // Regular paragraphs
      elements.push(
        <p key={index} className="text-muted-foreground mb-3 leading-relaxed">
          {renderInlineStyles(line)}
        </p>
      );
    });

    // Flush remaining
    flushTable();
    flushCode();
    flushCallout();

    return elements;
  };

  const renderInlineStyles = (text: string): React.ReactNode => {
    // Bold: **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      // Inline code: `code`
      const codeParts = part.split(/(`[^`]+`)/g);
      return codeParts.map((codePart, j) => {
        if (codePart.startsWith('`') && codePart.endsWith('`')) {
          return (
            <code key={`${i}-${j}`} className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-primary">
              {codePart.slice(1, -1)}
            </code>
          );
        }
        return codePart;
      });
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 rounded-xl transition-colors group border border-transparent hover:border-border">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {IconComponent && (
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconComponent className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground block">{subsection.title}</span>
            <HelpDifficultyBadge 
              difficulty={subsection.difficulty} 
              readTime={subsection.readTime}
              className="mt-1"
            />
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform shrink-0 ml-2',
            isOpen && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <div className="pt-4 pl-12 border-l-2 border-primary/20 ml-4">
          {renderContent(subsection.content)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
