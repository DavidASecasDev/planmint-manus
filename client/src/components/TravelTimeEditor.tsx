/**
 * TravelTimeEditor — Admin interface to view and override travel times for locations.
 * Shows cached Google Maps times and allows manual overrides.
 */
import { useState } from "react";
import {
  Clock,
  Edit3,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Navigation,
  AlertCircle,
} from "lucide-react";
import {
  useTravelTimeOverrides,
  type TravelTimeEntry,
} from "@/hooks/useTravelTimeOverrides";

export function TravelTimeEditor() {
  const { data, loading, error, upsert, remove } = useTravelTimeOverrides();
  const [expanded, setExpanded] = useState(false);
  const [editingDest, setEditingDest] = useState<string | null>(null);
  const [editMinutes, setEditMinutes] = useState<number>(0);
  const [addMode, setAddMode] = useState(false);
  const [newDest, setNewDest] = useState("");
  const [newMinutes, setNewMinutes] = useState<number>(15);
  const [saving, setSaving] = useState(false);

  const handleSave = async (destination: string, minutes: number) => {
    setSaving(true);
    const ok = await upsert(destination, minutes);
    setSaving(false);
    if (ok) {
      setEditingDest(null);
      setAddMode(false);
      setNewDest("");
      setNewMinutes(15);
    }
  };

  const handleDelete = async (destination: string) => {
    if (!confirm(`¿Eliminar el tiempo manual para "${destination}"? Se usará Google Maps la próxima vez.`)) return;
    setSaving(true);
    await remove(destination);
    setSaving(false);
  };

  const manualEntries = data.filter((e) => e.isManualOverride);
  const autoEntries = data.filter((e) => !e.isManualOverride);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Tiempos de Desplazamiento</span>
        </div>

        {!loading && (
          <div className="flex items-center gap-3 ml-2">
            <span className="text-xs text-muted-foreground">
              {data.length} ubicaciones · {manualEntries.length} manuales
            </span>
          </div>
        )}

        <div className="ml-auto">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800">
          {loading && (
            <div className="flex items-center justify-center py-6 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cargando tiempos...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 py-3 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {!loading && (
            <>
              {/* Info */}
              <p className="text-xs text-muted-foreground mt-3 mb-4">
                Los tiempos se obtienen automáticamente de Google Maps con tráfico estimado.
                Puedes añadir ajustes manuales que tendrán prioridad sobre Google Maps.
              </p>

              {/* Manual overrides section */}
              {manualEntries.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Ajustes manuales
                  </h4>
                  <div className="space-y-1.5">
                    {manualEntries.map((entry) => (
                      <TravelTimeRow
                        key={entry.destNormalized}
                        entry={entry}
                        isEditing={editingDest === entry.destination}
                        editMinutes={editMinutes}
                        saving={saving}
                        onStartEdit={() => {
                          setEditingDest(entry.destination);
                          setEditMinutes(entry.travelMinutes);
                        }}
                        onCancelEdit={() => setEditingDest(null)}
                        onChangeMinutes={setEditMinutes}
                        onSave={() => handleSave(entry.destination, editMinutes)}
                        onDelete={() => handleDelete(entry.destination)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Auto (Google Maps) entries */}
              {autoEntries.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Tiempos automáticos (Google Maps)
                  </h4>
                  <div className="space-y-1.5">
                    {autoEntries.map((entry) => (
                      <TravelTimeRow
                        key={entry.destNormalized}
                        entry={entry}
                        isEditing={editingDest === entry.destination}
                        editMinutes={editMinutes}
                        saving={saving}
                        onStartEdit={() => {
                          setEditingDest(entry.destination);
                          setEditMinutes(entry.travelMinutes);
                        }}
                        onCancelEdit={() => setEditingDest(null)}
                        onChangeMinutes={setEditMinutes}
                        onSave={() => handleSave(entry.destination, editMinutes)}
                        onDelete={() => handleDelete(entry.destination)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {data.length === 0 && !loading && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No hay tiempos cacheados todavía. Se generarán automáticamente al calcular la carga de trabajo.
                </div>
              )}

              {/* Add new override */}
              {addMode ? (
                <div className="mt-3 p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium">Nuevo ajuste manual</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newDest}
                      onChange={(e) => setNewDest(e.target.value)}
                      placeholder="Nombre de la ubicación (ej. Aeropuerto de Palma)"
                      className="flex-1 text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        value={newMinutes}
                        onChange={(e) => setNewMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                        min={0}
                        max={180}
                        className="w-16 text-sm text-center px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                    <button
                      onClick={() => newDest.trim() && handleSave(newDest.trim(), newMinutes)}
                      disabled={!newDest.trim() || saving}
                      className="p-1.5 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setAddMode(false);
                        setNewDest("");
                        setNewMinutes(15);
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddMode(true)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir ajuste manual
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TravelTimeRow({
  entry,
  isEditing,
  editMinutes,
  saving,
  onStartEdit,
  onCancelEdit,
  onChangeMinutes,
  onSave,
  onDelete,
}: {
  entry: TravelTimeEntry;
  isEditing: boolean;
  editMinutes: number;
  saving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeMinutes: (v: number) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const distKm = entry.distanceMeters
    ? (entry.distanceMeters / 1000).toFixed(1)
    : null;

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-sm flex-1 min-w-0 truncate" title={entry.destination}>
        {entry.destination}
      </span>

      {distKm && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {distKm} km
        </span>
      )}

      {isEditing ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            value={editMinutes}
            onChange={(e) => onChangeMinutes(Math.max(0, parseInt(e.target.value) || 0))}
            min={0}
            max={180}
            className="w-14 text-sm text-center px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />
          <span className="text-[10px] text-muted-foreground">min</span>
          <button
            onClick={onSave}
            disabled={saving}
            className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={onCancelEdit}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span
            className={`text-sm font-medium tabular-nums ${
              entry.isManualOverride
                ? "text-blue-600 dark:text-blue-400"
                : "text-foreground"
            }`}
          >
            {entry.travelMinutes} min
          </span>
          {entry.travelMinutesTraffic &&
            entry.travelMinutesTraffic !== entry.travelMinutes && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                ({entry.travelMinutesTraffic} con tráfico)
              </span>
            )}
          {entry.isManualOverride && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium">
              Manual
            </span>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onStartEdit}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Editar tiempo"
            >
              <Edit3 className="h-3 w-3 text-muted-foreground" />
            </button>
            {entry.isManualOverride && (
              <button
                onClick={onDelete}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                title="Eliminar ajuste manual"
              >
                <Trash2 className="h-3 w-3 text-red-500" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
