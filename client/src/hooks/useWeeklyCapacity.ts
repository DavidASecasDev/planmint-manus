/**
 * Hook to fetch weekly staff capacity data (7 days).
 * Auto-refreshes every 5 minutes to keep travel time data current.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

/** Auto-refresh interval: 5 minutes (in milliseconds) */
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export interface ReinforcementSuggestion {
  userId: string;
  name: string;
  teamName: string;
  shiftStart: string;
  shiftEnd: string;
  availableHours: number[];
}

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
  reinforcements: ReinforcementSuggestion[];
}

export function useWeeklyCapacity(startDate: string | null) {
  const { session } = useAuth();
  const [data, setData] = useState<DaySummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      setError(err.message || "Error de red");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, session?.access_token]);

  // Initial fetch
  useEffect(() => {
    fetchWeekly();
  }, [fetchWeekly]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!startDate || !session?.access_token) return;

    intervalRef.current = setInterval(() => {
      fetchWeekly();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startDate, session?.access_token, fetchWeekly]);

  return { data, loading, error, lastUpdated, refetch: fetchWeekly };
}
