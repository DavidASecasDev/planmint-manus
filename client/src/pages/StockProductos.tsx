/*
 * Stock Productos — Gestión de faltas de producto
 * El equipo de preparación puede reportar productos que faltan.
 * Los admins pueden gestionar categorías y marcar como resuelto.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { apiInvoke } from '@/lib/apiClient';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import {
  Package, Plus, CheckCircle2, Clock, AlertTriangle,
  Camera, Trash2, Settings2, Edit2, X, Image as ImageIcon,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────
interface ProductCategory {
  id: string;
  name: string;
  icon: string | null;
  created_at: string;
}

interface ShortageReport {
  id: string;
  category_id: string | null;
  category_name: string | null;
  product_name: string | null;
  product_brand: string | null;
  photo_url: string | null;
  notes: string | null;
  status: 'pending' | 'resolved';
  reported_by_name: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function StockProductos() {
  const { organization, profile } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [deletingReport, setDeletingReport] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['product-categories', organization?.id],
    queryFn: async () => {
      const result = await apiInvoke<{ ok: boolean; data: ProductCategory[] }>('product-categories', {
        body: {},
      });
      if (result.error || !result.data?.ok) throw new Error(result.error?.message || 'Error');
      return result.data.data;
    },
    enabled: !!organization?.id,
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['shortage-reports', organization?.id],
    queryFn: async () => {
      const result = await apiInvoke<{ ok: boolean; data: ShortageReport[] }>('product-shortage-reports', {
        body: {},
      });
      if (result.error || !result.data?.ok) throw new Error(result.error?.message || 'Error');
      return result.data.data;
    },
    enabled: !!organization?.id,
  });

  const pendingReports = useMemo(() => reports.filter(r => r.status === 'pending'), [reports]);
  const resolvedReports = useMemo(() => reports.filter(r => r.status === 'resolved'), [reports]);

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const resolveReport = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiInvoke<{ ok: boolean }>('resolve-shortage-report', { body: { id } });
      if (result.error || !result.data?.ok) throw new Error(result.error?.message || 'Error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortage-reports'] });
      queryClient.invalidateQueries({ queryKey: ['shortage-count'] });
      toast({ title: 'Resuelto', description: 'Producto marcado como repuesto' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const unresolveReport = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiInvoke<{ ok: boolean }>('unresolve-shortage-report', { body: { id } });
      if (result.error || !result.data?.ok) throw new Error(result.error?.message || 'Error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortage-reports'] });
      queryClient.invalidateQueries({ queryKey: ['shortage-count'] });
      toast({ title: 'Revertido', description: 'Producto marcado como pendiente de nuevo' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiInvoke<{ ok: boolean }>('delete-shortage-report', { body: { id } });
      if (result.error || !result.data?.ok) throw new Error(result.error?.message || 'Error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortage-reports'] });
      queryClient.invalidateQueries({ queryKey: ['shortage-count'] });
      setDeletingReport(null);
      toast({ title: 'Eliminado', description: 'Reporte eliminado' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiInvoke<{ ok: boolean }>('delete-product-category', { body: { id } });
      if (result.error || !result.data?.ok) throw new Error(result.error?.message || 'Error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setDeletingCategory(null);
      toast({ title: 'Eliminada', description: 'Categoría eliminada' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Stock Productos">
      <div className="space-y-6">
        <PageHeader
          title="Stock Productos"
          description="Reporta productos que faltan para que se repongan"
          icon={Package}
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingReports.length}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{resolvedReports.length}</p>
                <p className="text-xs text-muted-foreground">Resueltos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{categories.length}</p>
                <p className="text-xs text-muted-foreground">Categorías</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowReportDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Reportar Falta
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => { setEditingCategory(null); setShowCategoryDialog(true); }} className="gap-2">
              <Settings2 className="h-4 w-4" />
              Gestionar Categorías
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
            <TabsTrigger value="pending" className="gap-1.5 text-xs sm:text-sm">
              <Clock className="h-3.5 w-3.5" />
              Pendientes ({pendingReports.length})
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-1.5 text-xs sm:text-sm">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Resueltos ({resolvedReports.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {reportsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : pendingReports.length === 0 ? (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Todo en stock</p>
                  <p className="text-xs text-muted-foreground mt-0.5">No hay productos pendientes de reponer</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingReports.map(report => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    isAdmin={isAdmin}
                    onResolve={() => resolveReport.mutate(report.id)}
                    onDelete={() => setDeletingReport(report.id)}
                    onPhotoClick={() => setPhotoPreview(report.photo_url)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resolved" className="mt-4">
            {resolvedReports.length === 0 ? (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">No hay reportes resueltos aún</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {resolvedReports.map(report => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    isAdmin={isAdmin}
                    onUnresolve={() => unresolveReport.mutate(report.id)}
                    onDelete={() => setDeletingReport(report.id)}
                    onPhotoClick={() => setPhotoPreview(report.photo_url)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Report dialog */}
        <ReportFormDialog
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
          categories={categories}
          organizationId={organization?.id || ''}
        />

        {/* Category management dialog */}
        {isAdmin && (
          <CategoryManagementDialog
            open={showCategoryDialog}
            onOpenChange={setShowCategoryDialog}
            categories={categories}
            categoriesLoading={categoriesLoading}
            onEdit={(cat) => { setEditingCategory(cat); }}
            onDelete={(id) => setDeletingCategory(id)}
            editingCategory={editingCategory}
            setEditingCategory={setEditingCategory}
          />
        )}

        {/* Photo preview dialog */}
        {photoPreview && (
          <Dialog open={!!photoPreview} onOpenChange={() => setPhotoPreview(null)}>
            <DialogContent className="max-w-lg p-2">
              <img src={photoPreview} alt="Foto del producto" className="w-full rounded-lg" />
            </DialogContent>
          </Dialog>
        )}

        {/* Delete confirmation */}
        <AlertDialog open={!!deletingReport} onOpenChange={() => setDeletingReport(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar reporte?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingReport && deleteReport.mutate(deletingReport)}>
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete category confirmation */}
        <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará la categoría. Los reportes existentes conservarán su nombre.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingCategory && deleteCategory.mutate(deletingCategory)}>
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report Card
// ═══════════════════════════════════════════════════════════════════════════════
function ReportCard({
  report,
  isAdmin,
  onResolve,
  onUnresolve,
  onDelete,
  onPhotoClick,
}: {
  report: ShortageReport;
  isAdmin: boolean;
  onResolve?: () => void;
  onUnresolve?: () => void;
  onDelete: () => void;
  onPhotoClick: () => void;
}) {
  const isPending = report.status === 'pending';

  return (
    <Card className={`border-border/50 shadow-sm border-l-[3px] ${isPending ? 'border-l-red-500' : 'border-l-emerald-500'}`}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Photo thumbnail */}
          {report.photo_url && (
            <button
              onClick={onPhotoClick}
              className="flex-shrink-0 h-16 w-16 rounded-lg overflow-hidden border border-border/50 hover:opacity-80 transition-opacity"
            >
              <img src={report.photo_url} alt="" className="h-full w-full object-cover" />
            </button>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {report.category_name && (
                    <Badge variant="outline" className="text-xs">
                      {report.category_name}
                    </Badge>
                  )}
                  {report.product_name && (
                    <span className="text-sm font-medium text-foreground">{report.product_name}</span>
                  )}
                  {report.product_brand && (
                    <span className="text-xs text-muted-foreground">({report.product_brand})</span>
                  )}
                  {!report.category_name && !report.product_name && (
                    <span className="text-sm text-muted-foreground italic">Sin detalle</span>
                  )}
                </div>
                {report.notes && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{report.notes}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span>Reportado por: {report.reported_by_name || 'Desconocido'}</span>
                  <span>{new Date(report.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {report.status === 'resolved' && report.resolved_by_name && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Resuelto por {report.resolved_by_name} · {report.resolved_at ? new Date(report.resolved_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {isPending && onResolve && (
                  <Button size="sm" variant="ghost" onClick={onResolve} className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}
                {!isPending && onUnresolve && isAdmin && (
                  <Button size="sm" variant="ghost" onClick={onUnresolve} className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                    <Clock className="h-4 w-4" />
                  </Button>
                )}
                {isAdmin && (
                  <Button size="sm" variant="ghost" onClick={onDelete} className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report Form Dialog
// ═══════════════════════════════════════════════════════════════════════════════
function ReportFormDialog({
  open,
  onOpenChange,
  categories,
  organizationId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: ProductCategory[];
  organizationId: string;
}) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState('');
  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setCategoryId('');
    setProductName('');
    setProductBrand('');
    setNotes('');
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.82 });
      setPhotoFile(compressed.file);
      setPhotoPreviewUrl(URL.createObjectURL(compressed.file));
    } catch {
      setPhotoFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!categoryId && !productName) {
      toast({ title: 'Error', description: 'Selecciona una categoría o escribe el nombre del producto', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      let photoUrl: string | null = null;

      // Upload photo if provided
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const path = `${organizationId}/stock/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('damage-report-photos')
          .upload(path, photoFile, { upsert: true });

        if (uploadError) {
          toast({ title: 'Error al subir foto', description: uploadError.message, variant: 'destructive' });
        } else {
          const { data: urlData } = supabase.storage
            .from('damage-report-photos')
            .getPublicUrl(path);
          photoUrl = urlData.publicUrl;
        }
      }

      const result = await apiInvoke<{ ok: boolean }>('create-shortage-report', {
        body: {
          category_id: categoryId || null,
          product_name: productName || null,
          product_brand: productBrand || null,
          photo_url: photoUrl,
          notes: notes || null,
        },
      });

      if (result.error || !result.data?.ok) {
        throw new Error(result.error?.message || 'Error al crear reporte');
      }

      queryClient.invalidateQueries({ queryKey: ['shortage-reports'] });
      queryClient.invalidateQueries({ queryKey: ['shortage-count'] });
      toast({ title: 'Reportado', description: 'Falta de producto registrada correctamente' });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Reportar Falta de Producto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Category select */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Categoría</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoría..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product name */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Nombre del producto</label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ej: Limpiacristales, Ambientador..."
            />
          </div>

          {/* Brand */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Marca (opcional)</label>
            <Input
              value={productBrand}
              onChange={(e) => setProductBrand(e.target.value)}
              placeholder="Ej: Sonax, Meguiars..."
            />
          </div>

          {/* Photo */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Foto (opcional)</label>
            {photoPreviewUrl ? (
              <div className="relative inline-block">
                <img src={photoPreviewUrl} alt="Preview" className="h-24 w-24 rounded-lg object-cover border border-border" />
                <button
                  onClick={() => { setPhotoFile(null); setPhotoPreviewUrl(null); }}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Camera className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Subir foto</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
              </label>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Notas (opcional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles adicionales..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Enviando...' : 'Reportar Falta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Category Management Dialog
// ═══════════════════════════════════════════════════════════════════════════════
function CategoryManagementDialog({
  open,
  onOpenChange,
  categories,
  categoriesLoading,
  onEdit,
  onDelete,
  editingCategory,
  setEditingCategory,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: ProductCategory[];
  categoriesLoading: boolean;
  onEdit: (cat: ProductCategory) => void;
  onDelete: (id: string) => void;
  editingCategory: ProductCategory | null;
  setEditingCategory: (cat: ProductCategory | null) => void;
}) {
  const queryClient = useQueryClient();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newCategoryName.trim()) return;
    setSaving(true);
    try {
      const result = await apiInvoke<{ ok: boolean }>('create-product-category', {
        body: { name: newCategoryName.trim() },
      });
      if (result.error || !result.data?.ok) throw new Error(result.error?.message || 'Error');
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setNewCategoryName('');
      toast({ title: 'Creada', description: 'Categoría creada correctamente' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingCategory || !editName.trim()) return;
    setSaving(true);
    try {
      const result = await apiInvoke<{ ok: boolean }>('update-product-category', {
        body: { id: editingCategory.id, name: editName.trim() },
      });
      if (result.error || !result.data?.ok) throw new Error(result.error?.message || 'Error');
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setEditingCategory(null);
      toast({ title: 'Actualizada', description: 'Categoría actualizada' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Gestionar Categorías
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Create new */}
          <div className="flex gap-2">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nueva categoría..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={saving || !newCategoryName.trim()} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {categoriesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay categorías creadas</p>
            ) : (
              categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 hover:bg-muted/30">
                  {editingCategory?.id === cat.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" onClick={handleUpdate} disabled={saving} className="h-8 w-8 p-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)} className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium">{cat.name}</span>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { onEdit(cat); setEditName(cat.name); }} className="h-7 w-7 p-0">
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(cat.id)} className="h-7 w-7 p-0 text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
