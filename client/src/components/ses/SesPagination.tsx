import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSesPagination } from '@/lib/sesPagination';

export function SesPagination({ total, offset, limit, pageCount, onOffsetChange }: {
  total: number;
  offset: number;
  limit: number;
  pageCount: number;
  onOffsetChange: (offset: number) => void;
}) {
  if (total === 0) return null;
  const page = getSesPagination({ total, offset, limit, pageCount });
  return (
    <nav aria-label="Paginación de contratos SES" className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <span><strong>Página {page.currentPage} de {page.totalPages}</strong> · Mostrando {page.start}–{page.end} de {total} contratos filtrados</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!page.canPrevious} onClick={() => onOffsetChange(page.previousOffset)}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button>
        <Button variant="outline" size="sm" disabled={!page.canNext} onClick={() => onOffsetChange(page.nextOffset)}>Siguiente<ChevronRight className="ml-1 h-4 w-4" /></Button>
      </div>
    </nav>
  );
}
