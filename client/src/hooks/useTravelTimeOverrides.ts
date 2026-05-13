/**
 * Hook to manage travel time overrides (list, upsert, delete).
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface TravelTimeEntry {
  destination: string;
  destNormalized: string;
  travelMinutes: number;
  travelMinutesTraffic: number | null;
  distanceMeters: number | null;
  source: string;
  isManualOverride: boolean;
  hourBucket: number;
  updatedAt: string;
}

export function useTravelTimeOverrides() {
  const { session } = useAuth();
  const [data, setData] = useState<TravelTimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/travel-time-overrides/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Error al obtener tiempos");
        setData([]);
      } else {
        setData(json.data || []);
      }
    } catch (err: any) {
      setError(err.message || "Error de red");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  const upsert = useCallback(
    async (destination: string, travelMinutes: number) => {
      if (!session?.access_token) return false;

      try {
        const res = await fetch("/api/travel-time-overrides/upsert", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ destination, travelMinutes }),
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error || "Error al guardar");
          return false;
        }

        // Refresh list
        await fetchList();
        return true;
      } catch (err: any) {
        setError(err.message || "Error de red");
        return false;
      }
    },
    [session?.access_token, fetchList]
  );

  const remove = useCallback(
    async (destination: string) => {
      if (!session?.access_token) return false;

      try {
        const res = await fetch("/api/travel-time-overrides/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ destination }),
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error || "Error al eliminar");
          return false;
        }

        await fetchList();
        return true;
      } catch (err: any) {
        setError(err.message || "Error de red");
        return false;
      }
    },
    [session?.access_token, fetchList]
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { data, loading, error, refetch: fetchList, upsert, remove };
}
