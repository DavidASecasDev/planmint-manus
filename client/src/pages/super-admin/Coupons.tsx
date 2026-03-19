import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SuperAdminLayout } from './SuperAdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Ticket, Plus, Percent, DollarSign, Users, Calendar, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Coupons() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    description: '',
    discount_type: 'percent',
    discount_value: 0,
    duration: 'once',
    duration_months: 1,
    max_redemptions: null as number | null,
    redeem_by: '',
  });

  const { data: coupons, isLoading } = useQuery({
    queryKey: ['super-admin-coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: redemptions } = useQuery({
    queryKey: ['super-admin-coupon-redemptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupon_redemptions')
        .select(`
          *,
          coupons (code, discount_value, discount_type),
          organizations (name)
        `)
        .order('redeemed_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const toggleCouponMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-coupons'] });
      toast.success('Cupón actualizado');
    },
    onError: () => {
      toast.error('Error al actualizar cupón');
    },
  });

  const createCouponMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('coupons')
        .insert({
          code: newCoupon.code.toUpperCase(),
          description: newCoupon.description,
          discount_type: newCoupon.discount_type,
          discount_value: newCoupon.discount_value,
          duration: newCoupon.duration,
          duration_months: newCoupon.duration === 'repeating' ? newCoupon.duration_months : null,
          max_redemptions: newCoupon.max_redemptions,
          redeem_by: newCoupon.redeem_by || null,
          is_active: true,
          applicable_products_json: [],
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-coupons'] });
      setIsCreateOpen(false);
      setNewCoupon({
        code: '',
        description: '',
        discount_type: 'percent',
        discount_value: 0,
        duration: 'once',
        duration_months: 1,
        max_redemptions: null,
        redeem_by: '',
      });
      toast.success('Cupón creado exitosamente');
    },
    onError: () => {
      toast.error('Error al crear cupón');
    },
  });

  // Calculate stats
  const totalRedemptions = redemptions?.length || 0;
  const activeCoupons = coupons?.filter(c => c.is_active).length || 0;
  const totalSavings = redemptions?.reduce((acc, r) => {
    const coupon = r.coupons as any;
    if (coupon?.discount_type === 'percent') {
      return acc; // Can't calculate without original price
    }
    return acc + (coupon?.discount_value || 0);
  }, 0) || 0;

  return (
    <SuperAdminLayout title="Cupones">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cupones Activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{activeCoupons}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Redimidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">{totalRedemptions}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Cupones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">{coupons?.length || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ahorro Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-orange-600" />
                <span className="text-2xl font-bold">€{totalSavings}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coupons List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Cupones</CardTitle>
              <CardDescription>Gestiona los cupones de descuento</CardDescription>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Crear Cupón
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Cupón</DialogTitle>
                  <DialogDescription>
                    Define los detalles del cupón de descuento
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Código</Label>
                    <Input
                      value={newCoupon.code}
                      onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })}
                      placeholder="SUMMER2024"
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Input
                      value={newCoupon.description}
                      onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
                      placeholder="Descuento de verano"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Descuento</Label>
                      <Select
                        value={newCoupon.discount_type}
                        onValueChange={(v) => setNewCoupon({ ...newCoupon, discount_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Porcentaje</SelectItem>
                          <SelectItem value="fixed">Monto Fijo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor</Label>
                      <Input
                        type="number"
                        value={newCoupon.discount_value}
                        onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Duración</Label>
                    <Select
                      value={newCoupon.duration}
                      onValueChange={(v) => setNewCoupon({ ...newCoupon, duration: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Una vez</SelectItem>
                        <SelectItem value="repeating">Varios meses</SelectItem>
                        <SelectItem value="forever">Para siempre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newCoupon.duration === 'repeating' && (
                    <div className="space-y-2">
                      <Label>Duración en Meses</Label>
                      <Input
                        type="number"
                        value={newCoupon.duration_months}
                        onChange={(e) => setNewCoupon({ ...newCoupon, duration_months: Number(e.target.value) })}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Máximo de Redenciones (opcional)</Label>
                    <Input
                      type="number"
                      value={newCoupon.max_redemptions || ''}
                      onChange={(e) => setNewCoupon({ ...newCoupon, max_redemptions: e.target.value ? Number(e.target.value) : null })}
                      placeholder="Sin límite"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => createCouponMutation.mutate()}
                    disabled={!newCoupon.code || !newCoupon.discount_value}
                  >
                    Crear Cupón
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : coupons?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No hay cupones creados</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Descuento</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Redenciones</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Activo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons?.map((coupon) => {
                    const couponRedemptions = redemptions?.filter(r => r.coupon_id === coupon.id).length || 0;
                    return (
                      <TableRow key={coupon.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {coupon.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{coupon.description}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {coupon.discount_type === 'percent' ? (
                              <>
                                <Percent className="h-4 w-4 text-muted-foreground" />
                                <span>{coupon.discount_value}%</span>
                              </>
                            ) : (
                              <>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span>€{coupon.discount_value}</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {coupon.duration === 'once' ? 'Una vez' : 
                             coupon.duration === 'forever' ? 'Siempre' : 
                             `${coupon.duration_months} meses`}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {couponRedemptions}
                            {coupon.max_redemptions && ` / ${coupon.max_redemptions}`}
                          </span>
                        </TableCell>
                        <TableCell>
                          {coupon.redeem_by && new Date(coupon.redeem_by) < new Date() ? (
                            <Badge variant="secondary">Expirado</Badge>
                          ) : (
                            <Badge variant={coupon.is_active ? 'default' : 'secondary'}>
                              {coupon.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={coupon.is_active}
                            onCheckedChange={(checked) => 
                              toggleCouponMutation.mutate({ id: coupon.id, is_active: checked })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Redemptions */}
        <Card>
          <CardHeader>
            <CardTitle>Redenciones Recientes</CardTitle>
            <CardDescription>Últimos cupones utilizados</CardDescription>
          </CardHeader>
          <CardContent>
            {redemptions?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No hay redenciones</p>
            ) : (
              <div className="space-y-3">
                {redemptions?.slice(0, 10).map((redemption) => (
                  <div 
                    key={redemption.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <Ticket className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {(redemption.coupons as any)?.code}
                          </Badge>
                          <span className="text-sm font-medium">
                            {(redemption.organizations as any)?.name}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(redemption.redeemed_at), "d 'de' MMM, HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={redemption.status === 'active' ? 'default' : 'secondary'}>
                      {redemption.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
