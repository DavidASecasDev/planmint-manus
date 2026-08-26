import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CarFront, CheckCircle2, Loader2, Save, UserRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SesContractDraft, SesLocation, SesMunicipality, SesPersonProfile } from '@/types/sesHospedajes';

type UpdatePerson = (input: { id: string; values: Record<string, unknown> }) => Promise<unknown>;
type CreatePerson = (input: {
  draftId: string;
  role: 'holder' | 'primary_driver' | 'secondary_driver';
  values: Record<string, unknown>;
}) => Promise<unknown>;
type UpdateDraft = (input: { id: string; values: Record<string, unknown> }) => Promise<unknown>;
type UpdateLocation = (input: { id: string; values: Record<string, unknown> }) => Promise<unknown>;

interface Props {
  draft: SesContractDraft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdatePerson: UpdatePerson;
  onCreatePerson: CreatePerson;
  onUpdateDraft: UpdateDraft;
  onUpdateLocation: UpdateLocation;
  onSearchMunicipalities: (query: string, provinceCode?: string) => Promise<SesMunicipality[]>;
  saving: boolean;
}

const DOCUMENT_TYPES = ['NIF', 'NIE', 'PAS', 'OTRO'];
const LICENCE_TYPES = ['AM','AML','A1','A2','A','B','BE','C1','C1E','C','CE','D1','D1E','D','DE','LCM','LVA','ADR','PI','OT'];
const PAYMENT_TYPES = [
  ['DESTI', 'Pago en destino'], ['EFECT', 'Efectivo'], ['TARJT', 'Tarjeta'],
  ['PLATF', 'Plataforma de pago'], ['TRANS', 'Transferencia'], ['MOVIL', 'Pago móvil'],
  ['TREG', 'Tarjeta regalo'], ['OTRO', 'Otro'],
];
const VEHICLE_TYPES = [
  ['TURISMO', 'Turismo'], ['FURGONETA', 'Furgoneta'], ['CAMION', 'Camión'],
  ['AUTOBUS', 'Autobús'], ['MOTO', 'Moto'], ['TRACTOR', 'Tractor'],
  ['REMOLQUE', 'Remolque'], ['CAMPER', 'Camper'], ['CARAVANA', 'Caravana'], ['OTRO', 'Otro'],
];
const VEHICLE_COLORS = ['AMARILLO','AZUL','BEIGE','BLANCO','CIAN','GRANATE','GRIS','LILA','MARINO','MARRON','MOSTAZA','NARANJA','NEGRO','OLIVA','PLATA','PURPURA','ROJO','ROSA','SALMON','TURQUESA','VERDE','OTRO'];

function toLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalDateTime(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">
        {label}{required ? <span className="ml-1 text-rose-500">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function MunicipalityField({
  name,
  code,
  onNameChange,
  onSelect,
  search,
  foreign = false,
}: {
  name: string;
  code: string;
  onNameChange: (value: string) => void;
  onSelect: (municipality: SesMunicipality) => void;
  search: Props['onSearchMunicipalities'];
  foreign?: boolean;
}) {
  const [results, setResults] = useState<SesMunicipality[]>([]);
  const [loading, setLoading] = useState(false);

  const find = async () => {
    if (name.trim().length < 2) return;
    setLoading(true);
    try { setResults(await search(name.trim())); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-2">
      <div className={foreign ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-[1fr_8rem_auto] gap-2'}>
        <Input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Municipio" />
        {!foreign && <Input value={code} readOnly placeholder="Código INE" className="font-mono bg-slate-50" />}
        {!foreign && (
          <Button type="button" variant="outline" onClick={find} disabled={loading || name.trim().length < 2}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar INE'}
          </Button>
        )}
      </div>
      {results.length > 0 && (
        <div className="rounded-md border bg-white shadow-sm max-h-36 overflow-y-auto">
          {results.map((municipality) => (
            <button
              key={municipality.code}
              type="button"
              onClick={() => { onSelect(municipality); setResults([]); }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span>{municipality.name} <span className="text-slate-400">({municipality.province_name})</span></span>
              <code className="text-xs text-slate-500">{municipality.code}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function personToForm(person: SesPersonProfile | null) {
  return {
    document_type: person?.document_type ?? 'OTRO',
    document_number: person?.document_number ?? '',
    first_name: person?.first_name ?? '',
    first_surname: person?.first_surname ?? '',
    second_surname: person?.second_surname ?? '',
    birth_date: person?.birth_date ?? '',
    nationality_code: person?.nationality_code ?? '',
    sex: person?.sex ?? '',
    address_line: person?.address_line ?? '',
    address_number: person?.address_number ?? '',
    address_complement: person?.address_complement ?? '',
    municipality_code: person?.municipality_code ?? '',
    municipality_name: person?.municipality_name ?? '',
    postal_code: person?.postal_code ?? '',
    country_code: person?.country_code ?? '',
    phone: person?.phone ?? '',
    email: person?.email ?? '',
    licence_type: person?.licence_type ?? '',
    licence_valid_until: person?.licence_valid_until ?? '',
    licence_number: person?.licence_number ?? '',
    licence_support: person?.licence_support ?? '',
    licence_country_code: person?.licence_country_code ?? '',
  };
}

type PersonForm = ReturnType<typeof personToForm>;

function PersonEditor({
  title,
  person,
  form,
  setForm,
  searchMunicipalities,
  driver,
}: {
  title: string;
  person: SesPersonProfile | null;
  form: PersonForm;
  setForm: React.Dispatch<React.SetStateAction<PersonForm>>;
  searchMunicipalities: Props['onSearchMunicipalities'];
  driver: boolean;
}) {
  const set = (field: keyof PersonForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <Badge variant={person ? 'secondary' : 'destructive'}>{person ? 'Perfil reutilizable' : 'Crear perfil'}</Badge>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tipo de documento" required>
          <Select value={form.document_type} onValueChange={(value) => set('document_type', value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DOCUMENT_TYPES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Número de documento" required><Input value={form.document_number} onChange={(e) => set('document_number', e.target.value.toUpperCase())} /></Field>
        <Field label="Nombre" required><Input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} /></Field>
        <Field label="Primer apellido" required><Input value={form.first_surname} onChange={(e) => set('first_surname', e.target.value)} /></Field>
        <Field label="Segundo apellido" required={form.document_type === 'NIF'}><Input value={form.second_surname} onChange={(e) => set('second_surname', e.target.value)} /></Field>
        <Field label="Fecha de nacimiento"><Input type="date" value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} /></Field>
        <Field label="Nacionalidad ISO-3"><Input maxLength={3} value={form.nationality_code} onChange={(e) => set('nationality_code', e.target.value.toUpperCase())} placeholder="ESP" /></Field>
        <Field label="Sexo">
          <Select value={form.sex || undefined} onValueChange={(value) => set('sex', value)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent><SelectItem value="H">Hombre</SelectItem><SelectItem value="M">Mujer</SelectItem><SelectItem value="O">Otro</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Teléfono"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Correo electrónico"><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Domicilio" required><Input value={form.address_line} onChange={(e) => set('address_line', e.target.value)} /></Field>
        <Field label="Número"><Input value={form.address_number} onChange={(e) => set('address_number', e.target.value)} /></Field>
        <Field label="Complemento"><Input value={form.address_complement} onChange={(e) => set('address_complement', e.target.value)} /></Field>
        <Field label="Código postal" required><Input value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <Field label={form.country_code === 'ESP' ? 'Municipio y código INE' : 'Municipio'} required>
            <MunicipalityField
              name={form.municipality_name}
              code={form.municipality_code}
              onNameChange={(value) => set('municipality_name', value)}
              onSelect={(municipality) => setForm((current) => ({ ...current, municipality_name: municipality.name, municipality_code: municipality.code }))}
              search={searchMunicipalities}
              foreign={form.country_code !== 'ESP'}
            />
          </Field>
        </div>
        <Field label="País de residencia ISO-3" required><Input maxLength={3} value={form.country_code} onChange={(e) => set('country_code', e.target.value.toUpperCase())} placeholder="ESP" /></Field>
      </div>

      {driver && (
        <div className="border-t pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Permiso de conducir</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Tipo de permiso" required>
              <Select value={form.licence_type || undefined} onValueChange={(value) => set('licence_type', value)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{LICENCE_TYPES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Válido hasta" required><Input type="date" value={form.licence_valid_until} onChange={(e) => set('licence_valid_until', e.target.value)} /></Field>
            <Field label="Número de permiso" required><Input value={form.licence_number} onChange={(e) => set('licence_number', e.target.value.toUpperCase())} /></Field>
            <Field label="Número de soporte"><Input value={form.licence_support} onChange={(e) => set('licence_support', e.target.value.toUpperCase())} /></Field>
            <Field label="País expedidor ISO-3"><Input maxLength={3} value={form.licence_country_code} onChange={(e) => set('licence_country_code', e.target.value.toUpperCase())} placeholder="ESP" /></Field>
          </div>
        </div>
      )}
    </section>
  );
}

function locationToForm(location: SesLocation | null) {
  return {
    name: location?.name ?? '',
    use_establishment_code: location?.use_establishment_code ?? false,
    establishment_code: location?.establishment_code ?? '',
    address_line: location?.address_line ?? '',
    address_complement: location?.address_complement ?? '',
    municipality_code: location?.municipality_code ?? '',
    municipality_name: location?.municipality_name ?? '',
    postal_code: location?.postal_code ?? '',
    country_code: location?.country_code ?? 'ESP',
    verified: location?.verified ?? false,
  };
}

type LocationForm = ReturnType<typeof locationToForm>;

function LocationEditor({
  title,
  location,
  form,
  setForm,
  searchMunicipalities,
}: {
  title: string;
  location: SesLocation | null;
  form: LocationForm;
  setForm: React.Dispatch<React.SetStateAction<LocationForm>>;
  searchMunicipalities: Props['onSearchMunicipalities'];
}) {
  const set = <K extends keyof LocationForm>(field: K, value: LocationForm[K]) => setForm((current) => ({ ...current, [field]: value }));
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <Badge variant={location?.verified ? 'secondary' : 'outline'}>{location?.verified ? 'Verificado' : 'Pendiente de revisar'}</Badge>
      </div>
      {!location ? (
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>No hay ubicación reutilizable. Revisa la reserva en Rently.</AlertDescription></Alert>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombre" required><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Código de establecimiento">
            <Input maxLength={10} value={form.establishment_code} onChange={(e) => {
              set('establishment_code', e.target.value.toUpperCase());
              set('use_establishment_code', Boolean(e.target.value));
            }} placeholder="10 caracteres" />
          </Field>
          {!form.use_establishment_code && (
            <>
              <Field label="Dirección" required><Input value={form.address_line} onChange={(e) => set('address_line', e.target.value)} /></Field>
              <Field label="Complemento"><Input value={form.address_complement} onChange={(e) => set('address_complement', e.target.value)} /></Field>
              <Field label="Código postal" required><Input value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} /></Field>
              <Field label="País ISO-3" required><Input maxLength={3} value={form.country_code} onChange={(e) => set('country_code', e.target.value.toUpperCase())} /></Field>
              <div className="sm:col-span-2">
                <Field label={form.country_code === 'ESP' ? 'Municipio y código INE' : 'Municipio'} required>
                  <MunicipalityField
                    name={form.municipality_name}
                    code={form.municipality_code}
                    onNameChange={(value) => set('municipality_name', value)}
                    onSelect={(municipality) => setForm((current) => ({ ...current, municipality_name: municipality.name, municipality_code: municipality.code }))}
                    search={searchMunicipalities}
                    foreign={form.country_code !== 'ESP'}
                  />
                </Field>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function SesDraftEditor(props: Props) {
  const { draft } = props;
  const [contract, setContract] = useState({
    contract_date: '', pickup_at: '', return_at: '', payment_type: '', payment_date: '',
    vehicle_category: '', vehicle_type: '', vehicle_brand: '', vehicle_model: '', vehicle_plate: '', vehicle_vin: '', vehicle_color: '',
    km_pickup: '', km_return: '',
  });
  const [holder, setHolder] = useState<PersonForm>(() => personToForm(null));
  const [driver, setDriver] = useState<PersonForm>(() => personToForm(null));
  const [pickup, setPickup] = useState<LocationForm>(() => locationToForm(null));
  const [returnLocation, setReturnLocation] = useState<LocationForm>(() => locationToForm(null));

  useEffect(() => {
    if (!draft) return;
    setContract({
      contract_date: draft.contract_date ?? '',
      pickup_at: toLocalDateTime(draft.pickup_at),
      return_at: toLocalDateTime(draft.return_at),
      payment_type: draft.payment_type ?? '',
      payment_date: draft.payment_date ?? '',
      vehicle_category: draft.vehicle_category ?? '',
      vehicle_type: draft.vehicle_type ?? '',
      vehicle_brand: draft.vehicle_brand ?? '',
      vehicle_model: draft.vehicle_model ?? '',
      vehicle_plate: draft.vehicle_plate ?? '',
      vehicle_vin: draft.vehicle_vin ?? '',
      vehicle_color: draft.vehicle_color ?? '',
      km_pickup: draft.km_pickup === null || draft.km_pickup === undefined ? '' : String(draft.km_pickup),
      km_return: draft.km_return === null || draft.km_return === undefined ? '' : String(draft.km_return),
    });
    setHolder(personToForm(draft.holder));
    setDriver(personToForm(draft.primary_driver));
    setPickup(locationToForm(draft.pickup_location));
    setReturnLocation(locationToForm(draft.return_location));
  }, [draft]);

  const holderIsDriver = Boolean(draft?.holder?.id && draft.holder.id === draft.primary_driver?.id);
  const issueGroups = useMemo(() => {
    const groups: Record<string, number> = { contract: 0, holder: 0, driver: 0, locations: 0 };
    for (const issue of draft?.validation_errors ?? []) {
      if (issue.path.startsWith('holder')) groups.holder++;
      else if (issue.path.startsWith('primary_driver')) groups.driver++;
      else if (issue.path.includes('location')) groups.locations++;
      else groups.contract++;
    }
    return groups;
  }, [draft?.validation_errors]);

  const personValues = (form: PersonForm) => ({
    ...form,
    second_surname: nullable(form.second_surname), birth_date: nullable(form.birth_date),
    nationality_code: nullable(form.nationality_code), sex: nullable(form.sex),
    address_line: nullable(form.address_line), address_number: nullable(form.address_number),
    address_complement: nullable(form.address_complement), municipality_code: nullable(form.municipality_code),
    municipality_name: nullable(form.municipality_name), postal_code: nullable(form.postal_code),
    country_code: nullable(form.country_code), phone: nullable(form.phone), email: nullable(form.email),
    licence_type: nullable(form.licence_type), licence_valid_until: nullable(form.licence_valid_until),
    licence_number: nullable(form.licence_number), licence_support: nullable(form.licence_support),
    licence_country_code: nullable(form.licence_country_code),
  });

  const locationValues = (form: LocationForm) => ({
    ...form,
    establishment_code: nullable(form.establishment_code), address_line: nullable(form.address_line),
    address_complement: nullable(form.address_complement), municipality_code: nullable(form.municipality_code),
    municipality_name: nullable(form.municipality_name), postal_code: nullable(form.postal_code),
    country_code: form.country_code.toUpperCase(), verified: true,
  });

  const save = async () => {
    if (!draft) return;
    await props.onUpdateDraft({
      id: draft.id,
      values: {
        contract_date: nullable(contract.contract_date),
        pickup_at: fromLocalDateTime(contract.pickup_at),
        return_at: fromLocalDateTime(contract.return_at),
        payment_type: nullable(contract.payment_type),
        payment_date: nullable(contract.payment_date),
        vehicle_category: nullable(contract.vehicle_category),
        vehicle_type: nullable(contract.vehicle_type),
        vehicle_brand: nullable(contract.vehicle_brand),
        vehicle_model: nullable(contract.vehicle_model),
        vehicle_plate: nullable(contract.vehicle_plate),
        vehicle_vin: nullable(contract.vehicle_vin),
        vehicle_color: nullable(contract.vehicle_color),
        km_pickup: contract.km_pickup === '' ? null : Number(contract.km_pickup),
        km_return: contract.km_return === '' ? null : Number(contract.km_return),
      },
    });

    if (draft.holder) await props.onUpdatePerson({ id: draft.holder.id, values: personValues(holder) });
    else await props.onCreatePerson({ draftId: draft.id, role: 'holder', values: personValues(holder) });
    if (!holderIsDriver) {
      if (draft.primary_driver) await props.onUpdatePerson({ id: draft.primary_driver.id, values: personValues(driver) });
      else await props.onCreatePerson({ draftId: draft.id, role: 'primary_driver', values: personValues(driver) });
    }
    if (draft.pickup_location) await props.onUpdateLocation({ id: draft.pickup_location.id, values: locationValues(pickup) });
    if (draft.return_location) await props.onUpdateLocation({ id: draft.return_location.id, values: locationValues(returnLocation) });
  };

  if (!draft) return null;
  const clientName = [draft.reservation?.cliente_nombre, draft.reservation?.cliente_apellido].filter(Boolean).join(' ') || 'Sin cliente';

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full p-0 sm:max-w-3xl">
        <SheetHeader className="border-b bg-slate-50 px-6 py-5">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <SheetTitle>Contrato #{draft.reference}</SheetTitle>
              <SheetDescription>{clientName} · {draft.vehicle_plate || 'Sin vehículo'}</SheetDescription>
            </div>
            <Badge className={draft.status === 'ready' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'}>
              {draft.status === 'ready' ? 'Listo' : `${draft.validation_errors.length} datos pendientes`}
            </Badge>
          </div>
        </SheetHeader>

        <Tabs defaultValue={issueGroups.contract ? 'contract' : issueGroups.holder || issueGroups.driver ? 'person' : 'locations'} className="flex h-[calc(100vh-104px)] flex-col">
          <TabsList className="mx-6 mt-4 grid grid-cols-3">
            <TabsTrigger value="contract">Contrato {issueGroups.contract ? `(${issueGroups.contract})` : ''}</TabsTrigger>
            <TabsTrigger value="person">Personas {issueGroups.holder + issueGroups.driver ? `(${issueGroups.holder + issueGroups.driver})` : ''}</TabsTrigger>
            <TabsTrigger value="locations">Lugares {issueGroups.locations ? `(${issueGroups.locations})` : ''}</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 py-4">
            {draft.validation_errors.length > 0 ? (
              <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Revisión necesaria</AlertTitle>
                <AlertDescription>Solo debes completar los campos señalados. Los datos guardados se reutilizarán en futuras reservas.</AlertDescription>
              </Alert>
            ) : (
              <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-900">
                <CheckCircle2 className="h-4 w-4" /><AlertTitle>Contrato completo</AlertTitle><AlertDescription>Este contrato está listo para incluirse en un XML.</AlertDescription>
              </Alert>
            )}

            <TabsContent value="contract" className="mt-0 space-y-4">
              <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2"><CarFront className="h-4 w-4 text-slate-500" /><h3 className="font-semibold">Contrato y vehículo</h3></div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Fecha del contrato" required><Input type="date" value={contract.contract_date} onChange={(e) => setContract({ ...contract, contract_date: e.target.value })} /></Field>
                  <Field label="Tipo de pago" required>
                    <Select value={contract.payment_type || undefined} onValueChange={(value) => setContract({ ...contract, payment_type: value })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>{PAYMENT_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Recogida" required><Input type="datetime-local" value={contract.pickup_at} onChange={(e) => setContract({ ...contract, pickup_at: e.target.value })} /></Field>
                  <Field label="Devolución" required><Input type="datetime-local" value={contract.return_at} onChange={(e) => setContract({ ...contract, return_at: e.target.value })} /></Field>
                  <Field label="Categoría de empresa" required><Input value={contract.vehicle_category} onChange={(e) => setContract({ ...contract, vehicle_category: e.target.value })} placeholder="Ej. SUV" /></Field>
                  <Field label="Tipo de vehículo" required>
                    <Select value={contract.vehicle_type || undefined} onValueChange={(value) => setContract({ ...contract, vehicle_type: value })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>{VEHICLE_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Marca" required><Input value={contract.vehicle_brand} onChange={(e) => setContract({ ...contract, vehicle_brand: e.target.value })} /></Field>
                  <Field label="Modelo" required><Input value={contract.vehicle_model} onChange={(e) => setContract({ ...contract, vehicle_model: e.target.value })} /></Field>
                  <Field label="Matrícula" required><Input value={contract.vehicle_plate} onChange={(e) => setContract({ ...contract, vehicle_plate: e.target.value.toUpperCase() })} /></Field>
                  <Field label="Número de bastidor" required><Input value={contract.vehicle_vin} onChange={(e) => setContract({ ...contract, vehicle_vin: e.target.value.toUpperCase() })} /></Field>
                  <Field label="Color" required>
                    <Select value={contract.vehicle_color || undefined} onValueChange={(value) => setContract({ ...contract, vehicle_color: value })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>{VEHICLE_COLORS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Km en recogida" required><Input type="number" min={0} value={contract.km_pickup} onChange={(e) => setContract({ ...contract, km_pickup: e.target.value })} /></Field>
                  <Field label="Km en devolución"><Input type="number" min={0} value={contract.km_return} onChange={(e) => setContract({ ...contract, km_return: e.target.value })} /></Field>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="person" className="mt-0 space-y-4">
              <PersonEditor title={holderIsDriver ? 'Titular y conductor principal' : 'Titular del contrato'} person={draft.holder} form={holder} setForm={setHolder} searchMunicipalities={props.onSearchMunicipalities} driver={holderIsDriver} />
              {!holderIsDriver && <PersonEditor title="Conductor principal" person={draft.primary_driver} form={driver} setForm={setDriver} searchMunicipalities={props.onSearchMunicipalities} driver />}
            </TabsContent>

            <TabsContent value="locations" className="mt-0 space-y-4">
              <LocationEditor title="Lugar de recogida" location={draft.pickup_location} form={pickup} setForm={setPickup} searchMunicipalities={props.onSearchMunicipalities} />
              <LocationEditor title="Lugar de devolución" location={draft.return_location} form={returnLocation} setForm={setReturnLocation} searchMunicipalities={props.onSearchMunicipalities} />
            </TabsContent>
          </ScrollArea>

          <div className="flex items-center justify-between border-t bg-white px-6 py-4">
            <p className="text-xs text-slate-500"><UserRound className="mr-1 inline h-3.5 w-3.5" />Los perfiles y lugares se reutilizan automáticamente.</p>
            <Button onClick={save} disabled={props.saving}>
              {props.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar y validar
            </Button>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
