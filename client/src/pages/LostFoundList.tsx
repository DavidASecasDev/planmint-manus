import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, PackageSearch, Eye } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useLostFound,
  LOST_FOUND_STATUS_META,
  LOST_FOUND_CATEGORY_META,
  type LostFoundStatus,
  type LostFoundCategory,
} from '@/hooks/useLostFound';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function LostFoundList() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { items, isLoading, pendingCount } = useLostFound();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LostFoundStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<LostFoundCategory | 'all'>('all');

  const canCreate = hasPermission('lost_found.create');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      // Category filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      // Search
      if (search) {
        const q = search.toLowerCase();
        return (
          item.description.toLowerCase().includes(q) ||
          item.found_by.toLowerCase().includes(q) ||
          (item.client_name && item.client_name.toLowerCase().includes(q)) ||
          (item.vehicle_plate && item.vehicle_plate.toLowerCase().includes(q)) ||
          (item.found_location && item.found_location.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [items, search, statusFilter, categoryFilter]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AppLayout title="Objetos Perdidos">
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PackageSearch className="h-6 w-6 text-primary" />
            Objetos Perdidos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pendingCount > 0
              ? `${pendingCount} objeto${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''} de reclamar`
              : 'Gestión de objetos encontrados en vehículos'}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate('/lost-found/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Registrar objeto
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descripción, conductor, cliente, matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LostFoundStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(LOST_FOUND_STATUS_META).map(([key, meta]) => (
              <SelectItem key={key} value={key}>{meta.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as LostFoundCategory | 'all')}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {Object.entries(LOST_FOUND_CATEGORY_META).map(([key, meta]) => (
              <SelectItem key={key} value={key}>{meta.emoji} {meta.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(LOST_FOUND_STATUS_META).map(([status, meta]) => {
          const count = items.filter(i => i.status === status).length;
          return (
            <Card
              key={status}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                statusFilter === status && "ring-2 ring-primary"
              )}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status as LostFoundStatus)}
            >
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className={cn("text-xs font-medium", meta.color)}>{meta.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Items list */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PackageSearch className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {items.length === 0
                ? 'No hay objetos perdidos registrados'
                : 'No se encontraron resultados con los filtros aplicados'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const statusMeta = LOST_FOUND_STATUS_META[item.status];
            const categoryMeta = LOST_FOUND_CATEGORY_META[item.category];
            return (
              <Card
                key={item.id}
                className="cursor-pointer hover:shadow-md transition-all group"
                onClick={() => navigate(`/lost-found/${item.id}`)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Photo thumbnail or category emoji */}
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {item.photo_urls && item.photo_urls.length > 0 ? (
                      <img
                        src={item.photo_urls[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">{categoryMeta.emoji}</span>
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{item.description}</span>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", statusMeta.color, statusMeta.bgColor)}>
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{format(new Date(item.found_date), "d MMM yyyy", { locale: es })}</span>
                      <span>·</span>
                      <span>{categoryMeta.emoji} {categoryMeta.label}</span>
                      {item.vehicle_plate && (
                        <>
                          <span>·</span>
                          <span>🚗 {item.vehicle_plate}</span>
                        </>
                      )}
                      {item.client_name && (
                        <>
                          <span>·</span>
                          <span>👤 {item.client_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
    </AppLayout>
  );
}
