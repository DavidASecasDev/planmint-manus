import { useState, useEffect, useCallback, useRef } from "react";

export interface HourlyData {
  hour: number;
  entregas: number;
  devoluciones: number;
  total: number;
  locations: string[];
  load: "libre" | "baja" | "media" | "alta";
}

export interface FleetStatus {
  limpio: number;
  sucio: number;
  incompleto: number;
  en_servicio: number;
  alquilado: number;
  total: number;
}

export interface ModelAvailability {
  modelo: string;
  marca: string | null;
  categoria: string | null;
  limpios: number;
  pendientes: number;
  no_disponibles: number;
  total: number;
}

export interface OperationRow {
  type: "entrega" | "devolucion";
  time: string;
  location: string;
  modelo: string;
  auto: string;
  completed: boolean;
}

export interface PublicOperationsData {
  date: string;
  summary: {
    totalOperations: number;
    totalEntregas: number;
    totalDevoluciones: number;
    completedOps: number;
    pendingOps: number;
  };
  operations: OperationRow[];
  hourly: HourlyData[];
  recommendedSlots: Array<{ hour: number; load: string; currentOps: number }>;
  saturatedSlots: Array<{ hour: number; total: number; entregas: number; devoluciones: number }>;
  fleet: {
    status: FleetStatus;
    byModel: ModelAvailability[];
  };
  filters: {
    locations: string[];
  };
}

export function usePublicOperations(orgSlug: string, date?: string, location?: string) {
  const [data, setData] = useState<PublicOperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (location && location !== "all") params.set("location", location);

      const url = `/api/public/operations/${orgSlug}${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Organización no encontrada");
        }
        throw new Error("Error al cargar datos");
      }

      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [orgSlug, date, location]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 5 minutes
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
