/**
 * Hook to fetch weekly staff capacity data (7 days).
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface DaySummary {
  date: string;
  overallStatus: "sufficient" | "tight" | "deficit";
  overallUtilization: number;
  totalOperations: number;
  totalPersonMinutesNeeded: number;
  totalPersonMinutesAvailable: number;
  deficitHours: number[];
  tightHours: number[];
  summary: string;
}

export function useWeeklyCapacity(startDate: string | null) {
  const { session } = useAuth();
  const [data, setData] = useState<DaySummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeekly = useCallback(async () => {
    if (!startDate || !session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/get-staff-capacity-week", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ startDate }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Error al obtener capacidad semanal");
        setData(null);
      } else {
        setData(json.data);
      }
    } catch (err: any) {
      setError(err.message || "Error de red");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, session?.access_token]);

  useEffect(() => {
    fetchWeekly();
  }, [fetchWeekly]);

  return { data, loading, error, refetch: fetchWeekly };
}
