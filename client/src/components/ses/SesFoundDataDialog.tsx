import { useEffect, useMemo, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import type { SesReviewItem } from '@/types/sesHospedajes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const SES_PROPOSAL_FIELDS = {
  draft: ['payment_type','payment_date','payment_medium','payment_holder','card_expiry','vehicle_category','vehicle_type','vehicle_brand','vehicle_model','vehicle_plate','vehicle_vin','vehicle_color','km_pickup','km_return','gps_data'],
  person: ['document_type','document_number','first_name','first_surname','second_surname','birth_date','nationality_code','sex','address_line','address_number','address_complement','municipality_code','municipality_name','postal_code','country_code','phone','phone_secondary','email','licence_type','licence_valid_until','licence_number','licence_support','licence_country_code'],
  pickup_location: ['name','use_establishment_code','establishment_code','address_line','address_complement','municipality_code','municipality_name','postal_code','country_code','latitude','longitude','verified'],
  return_location: ['name','use_establishment_code','establishment_code','address_line','address_complement','municipality_code','municipality_name','postal_code','country_code','latitude','longitude','verified'],
} as const;
export type SesProposalTargetType = keyof typeof SES_PROPOSAL_FIELDS;
export type SesProposalTarget = { type: SesProposalTargetType; id: string; label: string; values: Record<string, unknown> };

const FIELD_LABELS: Record<string, string> = {
  document_type:'Tipo de documento',document_number:'Número de documento',first_name:'Nombre',first_surname:'Primer apellido',second_surname:'Segundo apellido',birth_date:'Fecha de nacimiento',nationality_code:'Nacionalidad',sex:'Sexo',address_line:'Domicilio',address_number:'Número',address_complement:'Complemento',municipality_code:'Municipio INE',municipality_name:'Municipio',postal_code:'Código postal',country_code:'País',phone:'Teléfono',phone_secondary:'Teléfono secundario',email:'Correo',licence_type:'Categoría del permiso',licence_valid_until:'Validez del permiso',licence_number:'Número del permiso',licence_support:'Soporte del permiso',licence_country_code:'País del permiso',payment_type:'Tipo de pago',payment_date:'Fecha de pago',payment_medium:'Medio de pago',payment_holder:'Titular del pago',card_expiry:'Caducidad de tarjeta',vehicle_category:'Categoría del vehículo',vehicle_type:'Tipo de vehículo',vehicle_brand:'Marca',vehicle_model:'Modelo',vehicle_plate:'Matrícula',vehicle_vin:'Bastidor',vehicle_color:'Color',km_pickup:'Kilómetros de recogida',km_return:'Kilómetros de devolución',gps_data:'Datos GPS',name:'Nombre del lugar',use_establishment_code:'Usar código de establecimiento',establishment_code:'Código de establecimiento',latitude:'Latitud',longitude:'Longitud',verified:'Verificado',
};
export const sesFieldLabel = (field: string) => FIELD_LABELS[field] ?? field.replaceAll('_', ' ');
export const sesDisplayValue = (value: unknown) => value === null || value === undefined || value === '' ? 'Vacío' : typeof value === 'object' ? JSON.stringify(value) : String(value);

export function getSesProposalTargets(item: SesReviewItem | null): SesProposalTarget[] {
  const draft = item?.draft;
  if (!draft) return [];
  const targets: SesProposalTarget[] = [{ type:'draft', id:draft.id, label:'Contrato', values:draft as Record<string, unknown> }];
  const add = (type: SesProposalTargetType, id: string | null | undefined, label: string, values?: Record<string, unknown> | null) => {
    if (id && values && !targets.some((target) => target.type === type && target.id === id)) targets.push({ type, id, label, values });
  };
  add('person',draft.holder_profile_id,'Titular',draft.holder); add('person',draft.primary_driver_profile_id,'Conductor principal',draft.primary_driver);
  add('person',draft.secondary_driver_profile_id,'Segundo conductor',draft.secondary_driver); add('pickup_location',draft.pickup_location_id,'Lugar de recogida',draft.pickup_location);
  add('return_location',draft.return_location_id,'Lugar de devolución',draft.return_location);
  return targets;
}

export function getSesReviewIssueLabels(item: SesReviewItem) {
  const missing = (item.draft?.validation_errors ?? []).map((issue) => issue.message || sesFieldLabel(issue.path));
  if (item.status === 'missing_delivery_evidence') missing.unshift('Referencia y fecha del justificante');
  const open = (item.conflicts ?? []).filter((conflict) => conflict.status !== 'resolved');
  const resolved = (item.conflicts ?? []).filter((conflict) => conflict.status === 'resolved');
  const conflicts = open.map((conflict) => sesFieldLabel(String(conflict.field ?? conflict.code ?? 'Contradicción')));
  return { missing:Array.from(new Set(missing)), conflicts:Array.from(new Set(conflicts)), resolvedCount:resolved.length };
}

export function SesFoundDataDialog({ batchId, item, open, onOpenChange, onSave, saving }: {
  batchId:string; item:SesReviewItem|null; open:boolean; onOpenChange:(open:boolean)=>void;
  onSave:(input:{batchId:string;itemId:string;source:'hubspot'|'respond'|'document';externalSubmissionId:string;targetType:SesProposalTargetType;targetId:string;payload:Record<string,string>;evidenceReference?:string;observedAt?:string})=>Promise<unknown>;
  saving:boolean;
}) {
  const targets = useMemo(() => getSesProposalTargets(item), [item]);
  const [targetKey,setTargetKey]=useState(''); const [field,setField]=useState(''); const [value,setValue]=useState('');
  const [source,setSource]=useState<'hubspot'|'respond'|'document'>('hubspot'); const [reference,setReference]=useState(''); const [observedAt,setObservedAt]=useState('');
  useEffect(()=>{ const first=targets[0]; setTargetKey(first?`${first.type}:${first.id}`:''); setField(first?SES_PROPOSAL_FIELDS[first.type][0]:''); setValue(''); setReference(''); setObservedAt(''); },[item?.id,open]);
  const target=targets.find((candidate)=>`${candidate.type}:${candidate.id}`===targetKey)??null; const fields=target?SES_PROPOSAL_FIELDS[target.type]:[];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Añadir dato encontrado</DialogTitle><DialogDescription>Registra un dato y su procedencia. Las diferencias quedan pendientes de revisión.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Destinatario</Label><Select value={targetKey} onValueChange={(next)=>{setTargetKey(next);const chosen=targets.find((candidate)=>`${candidate.type}:${candidate.id}`===next);setField(chosen?SES_PROPOSAL_FIELDS[chosen.type][0]:'');}}><SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger><SelectContent>{targets.map((candidate)=><SelectItem key={`${candidate.type}:${candidate.id}`} value={`${candidate.type}:${candidate.id}`}>{candidate.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Campo</Label><Select value={field} onValueChange={setField}><SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger><SelectContent>{fields.map((candidate)=><SelectItem key={candidate} value={candidate}>{sesFieldLabel(candidate)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label>Valor actual</Label><div className="min-h-10 rounded-md border bg-slate-50 px-3 py-2 text-sm">{sesDisplayValue(target?.values[field])}</div></div><div className="space-y-2 sm:col-span-2"><Label>Valor encontrado</Label><Input value={value} onChange={(event)=>setValue(event.target.value)}/></div><div className="space-y-2"><Label>Fuente</Label><Select value={source} onValueChange={(next)=>setSource(next as typeof source)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="hubspot">HubSpot</SelectItem><SelectItem value="respond">respond.io</SelectItem><SelectItem value="document">Documento</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Referencia</Label><Input value={reference} onChange={(event)=>setReference(event.target.value)} placeholder="ID o nombre verificable"/></div><div className="space-y-2 sm:col-span-2"><Label>Fecha de comprobación</Label><Input type="datetime-local" value={observedAt} onChange={(event)=>setObservedAt(event.target.value)}/></div></div><DialogFooter><Button variant="outline" onClick={()=>onOpenChange(false)}>Cancelar</Button><Button disabled={saving||!item||!target||!field||!value.trim()||!reference.trim()} onClick={async()=>{if(!item||!target)return;await onSave({batchId,itemId:item.id,source,externalSubmissionId:`${source}:${reference.trim()}:${item.id}:${target.type}:${field}`,targetType:target.type,targetId:target.id,payload:{[field]:value.trim()},evidenceReference:reference.trim(),observedAt:observedAt?new Date(observedAt).toISOString():undefined});onOpenChange(false);}}><PlusCircle className="mr-2 h-4 w-4"/>Guardar propuesta</Button></DialogFooter></DialogContent></Dialog>;
}
