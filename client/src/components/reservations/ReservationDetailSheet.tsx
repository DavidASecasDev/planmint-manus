import React from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Car,
  CreditCard,
  FileText,
  Fuel,
  Gauge,
  Globe,
  IdCard,
  MapPin,
  Package,
  Phone,
  Mail,
  User,
  Users,
  Clock,
  DollarSign,
  Tag,
  Hash,
  Info,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Palette,
  Wrench,
} from 'lucide-react';
import { Reservation, RentlyExtra, RentlyPriceItem, RentlyDriver } from '@/types/reservations';
import { ReservationEquipmentSection } from './ReservationEquipmentSection';

interface ReservationDetailSheetProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Colores de estado
const STATUS_COLORS: Record<string, string> = {
  'Pendiente': 'bg-amber-100 text-amber-800 border-amber-300',
  'Confirmada': 'bg-green-100 text-green-800 border-green-300',
  'En curso': 'bg-blue-100 text-blue-800 border-blue-300',
  'Completada': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Cancelada': 'bg-red-100 text-red-800 border-red-300',
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="text-xs">Sin estado</Badge>;
  const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  return (
    <Badge className={`${colorClass} border text-sm font-medium px-3 py-1`}>
      {status}
    </Badge>
  );
}

function InfoRow({ icon: Icon, label, value, className }: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  if (value === null || value === undefined || value === '' || value === '—') return null;
  return (
    <div className={`flex items-start gap-3 py-2 ${className || ''}`}>
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
      {children}
    </h3>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    return format(d, "dd MMM yyyy, HH:mm", { locale: es });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number | null, currency?: string | null): string {
  if (amount === null || amount === undefined) return '—';
  const cur = currency || 'EUR';
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: cur }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${cur}`;
  }
}

function FuelGauge({ level }: { level: number | null }) {
  if (level === null || level === undefined) return <span>—</span>;
  const percentage = Math.min(100, Math.max(0, level));
  const color = percentage > 60 ? 'bg-green-500' : percentage > 30 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-sm font-medium">{percentage}%</span>
    </div>
  );
}

/** Safely parse a JSON field that may be a string, an array, or null */
function safeParseJsonArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function ReservationDetailSheet({ reservation, open, onOpenChange }: ReservationDetailSheetProps) {
  if (!reservation) return null;

  const r = reservation;
  const clientName = [r.cliente_nombre, r.cliente_apellido].filter(Boolean).join(' ') || '—';
  const hasFinancialData = r.balance != null || r.total_pagado_rently != null || r.precio != null;
  const hasVehicleDetails = r.vehiculo_kms != null || r.vehiculo_color != null || r.vehiculo_anio != null;
  const hasRateDetails = r.tarifa_diaria != null || r.tarifa_hora != null;

  const parsedExtras = safeParseJsonArray<RentlyExtra>(r.extras_contratados);
  const parsedPriceBreakdown = safeParseJsonArray<RentlyPriceItem>(r.desglose_precios);
  const parsedAdditionalDrivers = safeParseJsonArray<RentlyDriver>(r.conductores_adicionales);

  const hasExtras = parsedExtras.length > 0;
  const hasPriceBreakdown = parsedPriceBreakdown.length > 0;
  const hasAdditionalDrivers = parsedAdditionalDrivers.length > 0;
  const hasExtendedClient = r.cliente_direccion || r.cliente_ciudad || r.cliente_carnet_numero || r.cliente_fecha_nacimiento;
  const hasAddressDetails = r.lugar_entrega_direccion || r.lugar_devolucion_direccion;
  const isRentlyEnriched = r.rently_detail_synced_at != null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <SheetTitle className="text-lg font-bold truncate">
                  Reserva #{r.external_reservation_id}
                </SheetTitle>
                {isRentlyEnriched && (
                  <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0">
                    Rently
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{clientName}</p>
            </div>
            <StatusBadge status={r.estado} />
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 pt-2 h-auto gap-2">
              <TabsTrigger value="general" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
                General
              </TabsTrigger>
              <TabsTrigger value="cliente" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
                Cliente
              </TabsTrigger>
              <TabsTrigger value="vehiculo" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
                Vehículo
              </TabsTrigger>
              <TabsTrigger value="financiero" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
                Financiero
              </TabsTrigger>
              <TabsTrigger value="extras" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
                Extras
              </TabsTrigger>
            </TabsList>

            {/* === TAB: General === */}
            <TabsContent value="general" className="px-6 py-4 space-y-6 mt-0">
              {/* Fechas y duración */}
              <div>
                <SectionTitle>
                  <Calendar className="h-4 w-4" /> Fechas
                </SectionTitle>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-muted/30 rounded-lg p-3">
                  <InfoRow icon={Calendar} label="Desde" value={formatDate(r.desde)} />
                  <InfoRow icon={Calendar} label="Hasta" value={formatDate(r.hasta)} />
                  {r.devolucion && r.devolucion !== r.hasta && (
                    <InfoRow icon={Calendar} label="Devolución real" value={formatDate(r.devolucion)} />
                  )}
                  <InfoRow icon={Clock} label="Duración" value={r.duracion} />
                  <InfoRow icon={Calendar} label="Creada" value={formatDate(r.fecha_creacion)} />
                  <InfoRow icon={Tag} label="Origen" value={r.origen_reserva} />
                </div>
              </div>

              {/* Lugares */}
              <div>
                <SectionTitle>
                  <MapPin className="h-4 w-4" /> Lugares
                </SectionTitle>
                <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-600" />
                      <div className="w-0.5 h-8 bg-border" />
                      <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-orange-600" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Entrega</p>
                        <p className="text-sm font-medium">{r.lugar_entrega || '—'}</p>
                        {r.lugar_entrega_direccion && (
                          <p className="text-xs text-muted-foreground">{r.lugar_entrega_direccion}{r.lugar_entrega_ciudad ? `, ${r.lugar_entrega_ciudad}` : ''}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Devolución</p>
                        <p className="text-sm font-medium">{r.lugar_devolucion || '—'}</p>
                        {r.lugar_devolucion_direccion && (
                          <p className="text-xs text-muted-foreground">{r.lugar_devolucion_direccion}{r.lugar_devolucion_ciudad ? `, ${r.lugar_devolucion_ciudad}` : ''}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado operativo */}
              <div>
                <SectionTitle>
                  <Info className="h-4 w-4" /> Estado operativo
                </SectionTitle>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-muted/30 rounded-lg p-3">
                  <InfoRow icon={Tag} label="Tipo actividad" value={r.tipo_actividad} />
                  <InfoRow icon={Hash} label="Código" value={r.codigo} />
                  <InfoRow icon={Tag} label="Categoría" value={r.categoria} />
                  <InfoRow icon={Tag} label="Tarifa" value={r.tarifa} />
                  <InfoRow icon={FileText} label="Acuerdo comercial" value={r.acuerdo_comercial} />
                  <InfoRow icon={FileText} label="Acuerdo precios" value={r.acuerdo_precios} />
                  {r.rently_status_date && (
                    <InfoRow icon={Clock} label="Último cambio estado (Rently)" value={formatDate(r.rently_status_date)} />
                  )}
                </div>
              </div>

              {/* Notas */}
              {r.notas && (
                <div>
                  <SectionTitle>
                    <FileText className="h-4 w-4" /> Notas
                  </SectionTitle>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-sm whitespace-pre-wrap">{r.notas}</p>
                  </div>
                </div>
              )}

              {/* Sync info */}
              {isRentlyEnriched && (
                <div className="text-xs text-muted-foreground flex items-center gap-1 pt-2">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Datos de Rently actualizados: {formatDate(r.rently_detail_synced_at)}
                </div>
              )}
            </TabsContent>

            {/* === TAB: Cliente === */}
            <TabsContent value="cliente" className="px-6 py-4 space-y-6 mt-0">
              <div>
                <SectionTitle>
                  <User className="h-4 w-4" /> Datos del cliente
                </SectionTitle>
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <InfoRow icon={User} label="Nombre completo" value={clientName} />
                  <InfoRow icon={Mail} label="Email" value={r.email} />
                  <InfoRow icon={Phone} label="Teléfono" value={r.telefono} />
                  <InfoRow icon={IdCard} label="Documento" value={
                    r.documento_cliente ? `${r.tipo_documento_cliente || ''} ${r.documento_cliente}`.trim() : null
                  } />
                  {r.cliente_edad && (
                    <InfoRow icon={User} label="Edad" value={`${r.cliente_edad} años`} />
                  )}
                  <InfoRow icon={Calendar} label="Fecha nacimiento" value={r.cliente_fecha_nacimiento} />
                  <InfoRow icon={FileText} label="Notas del cliente" value={r.cliente_notas} />
                </div>
              </div>

              {/* Dirección */}
              {hasExtendedClient && (
                <div>
                  <SectionTitle>
                    <MapPin className="h-4 w-4" /> Dirección
                  </SectionTitle>
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                    <InfoRow icon={MapPin} label="Dirección" value={r.cliente_direccion} />
                    <InfoRow icon={MapPin} label="Ciudad" value={r.cliente_ciudad} />
                    <InfoRow icon={MapPin} label="Provincia/Estado" value={r.cliente_estado} />
                    <InfoRow icon={Globe} label="País" value={r.cliente_pais} />
                  </div>
                </div>
              )}

              {/* Carnet de conducir */}
              {r.cliente_carnet_numero && (
                <div>
                  <SectionTitle>
                    <IdCard className="h-4 w-4" /> Carnet de conducir
                  </SectionTitle>
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                    <InfoRow icon={IdCard} label="Número" value={r.cliente_carnet_numero} />
                    <InfoRow icon={Globe} label="País emisión" value={r.cliente_carnet_pais} />
                    <InfoRow icon={Calendar} label="Expiración" value={r.cliente_carnet_expiracion} />
                  </div>
                </div>
              )}

              {/* Conductores adicionales */}
              {hasAdditionalDrivers && (
                <div>
                  <SectionTitle>
                    <Users className="h-4 w-4" /> Conductores adicionales
                  </SectionTitle>
                  <div className="space-y-2">
                    {parsedAdditionalDrivers.map((driver, i) => (
                      <div key={i} className="bg-muted/30 rounded-lg p-3 space-y-1">
                        <InfoRow icon={User} label="Nombre" value={driver.nombre || driver.name} />
                        <InfoRow icon={IdCard} label="Documento" value={driver.documento || driver.document} />
                        <InfoRow icon={IdCard} label="Carnet" value={driver.carnet || driver.license_number} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* === TAB: Vehículo === */}
            <TabsContent value="vehiculo" className="px-6 py-4 space-y-6 mt-0">
              <div>
                <SectionTitle>
                  <Car className="h-4 w-4" /> Datos del vehículo
                </SectionTitle>
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <InfoRow icon={Car} label="Modelo" value={r.modelo} />
                  <InfoRow icon={Hash} label="Matrícula" value={r.auto} />
                  <InfoRow icon={Tag} label="Categoría" value={r.categoria} />
                  {r.vehiculo_anio != null && (
                    <InfoRow icon={Calendar} label="Año" value={String(r.vehiculo_anio)} />
                  )}
                  <InfoRow icon={Palette} label="Color" value={r.vehiculo_color} />
                  <InfoRow icon={Wrench} label="Chasis" value={r.vehiculo_chasis} />
                  <InfoRow icon={Fuel} label="Tipo combustible" value={r.vehiculo_tipo_combustible} />
                </div>
              </div>

              {/* Indicadores del vehículo */}
              {hasVehicleDetails && (
                <div>
                  <SectionTitle>
                    <Gauge className="h-4 w-4" /> Indicadores
                  </SectionTitle>
                  <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                    {r.vehiculo_kms != null && (
                      <div className="flex items-center gap-3">
                        <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Kilómetros</p>
                          <p className="text-sm font-medium">{Number(r.vehiculo_kms).toLocaleString('es-ES')} km</p>
                        </div>
                      </div>
                    )}
                    {r.vehiculo_combustible != null && (
                      <div className="flex items-center gap-3">
                        <Fuel className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Nivel de combustible</p>
                          <FuelGauge level={r.vehiculo_combustible} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tarifas y kilómetros */}
              {hasRateDetails && (
                <div>
                  <SectionTitle>
                    <DollarSign className="h-4 w-4" /> Tarifas del vehículo
                  </SectionTitle>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <InfoRow icon={DollarSign} label="Tarifa diaria" value={formatCurrency(r.tarifa_diaria, r.moneda)} />
                      <InfoRow icon={DollarSign} label="Tarifa por hora" value={formatCurrency(r.tarifa_hora, r.moneda)} />
                      <InfoRow icon={DollarSign} label="Día extra" value={formatCurrency(r.tarifa_dia_extra, r.moneda)} />
                      <InfoRow icon={DollarSign} label="Hora extra" value={formatCurrency(r.tarifa_hora_extra, r.moneda)} />
                    </div>
                    <Separator className="my-2" />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <InfoRow icon={Gauge} label="Km ilimitados" value={
                        r.km_ilimitados === true ? (
                          <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Sí</span>
                        ) : r.km_ilimitados === false ? (
                          <span className="flex items-center gap-1 text-amber-600"><XCircle className="h-3.5 w-3.5" /> No</span>
                        ) : null
                      } />
                      {r.km_max_permitidos != null && r.km_max_permitidos !== 0 && (
                        <InfoRow icon={Gauge} label="Km máx. total" value={`${Number(r.km_max_permitidos).toLocaleString('es-ES')} km`} />
                      )}
                      {r.km_max_por_dia != null && r.km_max_por_dia !== 0 && (
                        <InfoRow icon={Gauge} label="Km máx. por día" value={`${Number(r.km_max_por_dia).toLocaleString('es-ES')} km/día`} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* === TAB: Financiero === */}
            <TabsContent value="financiero" className="px-6 py-4 space-y-6 mt-0">
              {/* Resumen financiero */}
              <div>
                <SectionTitle>
                  <CreditCard className="h-4 w-4" /> Resumen financiero
                </SectionTitle>
                <div className="bg-muted/30 rounded-lg p-3">
                  {/* Precio total destacado */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b">
                    <span className="text-sm text-muted-foreground">Precio total</span>
                    <span className="text-xl font-bold">{formatCurrency(r.precio, r.moneda)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <InfoRow icon={CreditCard} label="Total pagado" value={formatCurrency(r.total_pagado_rently, r.moneda)} />
                    <InfoRow icon={CreditCard} label="Balance" value={
                      r.balance != null ? (
                        <span className={r.balance > 0 ? 'text-red-600 font-semibold' : r.balance < 0 ? 'text-green-600' : ''}>
                          {formatCurrency(r.balance, r.moneda)}
                        </span>
                      ) : null
                    } />
                    <InfoRow icon={CreditCard} label="Prepago" value={formatCurrency(r.prepago, r.moneda)} />
                    <InfoRow icon={CreditCard} label="Pagado por agencia" value={formatCurrency(r.pagado_por_agencia, r.moneda)} />
                    <InfoRow icon={CreditCard} label="Pagado por cliente" value={formatCurrency(r.pagado_por_cliente, r.moneda)} />
                    <InfoRow icon={DollarSign} label="Comisión ventas" value={formatCurrency(r.comision_ventas, r.moneda)} />
                  </div>
                </div>
              </div>

              {/* Desglose de precios */}
              {hasPriceBreakdown && (
                <div>
                  <SectionTitle>
                    <FileText className="h-4 w-4" /> Desglose de precios
                  </SectionTitle>
                  <div className="bg-muted/30 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Concepto</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedPriceBreakdown.map((item, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="px-3 py-2 text-sm">{item.descripcion || item.description}</td>
                            <td className="px-3 py-2 text-sm text-right font-medium">
                              {formatCurrency(item.importe ?? item.amount ?? null, r.moneda)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!hasFinancialData && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Sin datos financieros disponibles</p>
                  <p className="text-xs mt-1">Los datos se importarán en la próxima sincronización con Rently</p>
                </div>
              )}
            </TabsContent>

            {/* === TAB: Extras === */}
            <TabsContent value="extras" className="px-6 py-4 space-y-6 mt-0">
                {/* Extras contratados */}
                {hasExtras && (
                  <div>
                    <SectionTitle>
                      <Package className="h-4 w-4" /> Extras contratados
                    </SectionTitle>
                    <div className="bg-muted/30 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Extra</th>
                            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Cant.</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Precio</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedExtras.map((extra, i) => {
                            const precio = extra.precio ?? extra.price ?? null;
                            const cantidad = extra.cantidad ?? extra.quantity ?? 1;
                            const total = extra.total ?? (precio != null ? precio * cantidad : null);
                            return (
                              <tr key={i} className="border-b border-border/50 last:border-0">
                                <td className="px-3 py-2 text-sm">
                                  <div>{extra.nombre || extra.name || '—'}</div>
                                  {extra.por_dia && (
                                    <span className="text-[10px] text-muted-foreground">por día</span>
                                  )}
                                  {extra.tipo && (
                                    <span className="text-[10px] text-muted-foreground ml-1">({extra.tipo})</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-sm text-center">{cantidad}</td>
                                <td className="px-3 py-2 text-sm text-right">{formatCurrency(precio, r.moneda)}</td>
                                <td className="px-3 py-2 text-sm text-right font-medium">{formatCurrency(total, r.moneda)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {/* Equipamiento asignado */}
                <Separator />
                <ReservationEquipmentSection
                  reservationId={r.id}
                  vehicleMatricula={r.auto || undefined}
                />
              </TabsContent>
          </Tabs>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
