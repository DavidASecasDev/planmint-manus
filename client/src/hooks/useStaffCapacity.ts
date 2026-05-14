/**
 * Hook to fetch staff capacity data for a given date.
 * Calls the /api/get-staff-capacity endpoint.
 * Auto-refreshes every 5 minutes to keep travel time data current.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

/** Auto-refresh interval: 5 minutes (in milliseconds) */
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export interface CapacityOperation {
  reservationId: string;
  type: "Entrega" | "Devolución" | "Transfer";
  datetime: string;
  hour: number;
  location: string | null;
  isAtBase: boolean;
  travelMinutesOneWay: number;
  personMinutes: number;
  peopleNeeded: number;
  isCompleted: boolean;
}

export interface ReinforcementSuggestion {
  userId: string;
  name: string;
  teamName: string;
  shiftStart: string;
  shiftEnd: string;
  availableHours: number[];
}

export interface HourSlot {
  hour: number;
  label: string;
  operations: CapacityOperation[];
  totalPersonMinutes: number;
  availablePersonMinutes: number;
  availableStaff: {
    rentals: string[];
    preparacion: string[];
    mostrador: string[];
  };
  utilizationPct: number;
  status: "sufficient" | "tight" | "deficit";
  reinforcements: ReinforcementSuggestion[];
}

export interface CapacityResult {
  date: string;
  overallStatus: "sufficient" | "tight" | "deficit";
  overallUtilization: number;
  totalOperations: number;
  totalPersonMinutesNeeded: number;
  totalPersonMinutesAvailable: number;
  hourSlots: HourSlot[];
  deficitHours: number[];
  tightHours: number[];
  summary: string;
  reinforcements: ReinforcementSuggestion[];
}

export function useStaffCapacity(date: string | null) {
  const { session } = useAuth();
  const [data, setData] = useState<CapacityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCapacity = useCallback(async () => {
    if (!date || !session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/get-staff-capacity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ date }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Error al obtener capacidad");
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
  }, [date, session?.access_token]);

  // Initial fetch
  useEffect(() => {
    fetchCapacity();
  }, [fetchCapacity]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!date || !session?.access_token) return;

    intervalRef.current = setInterval(() => {
      fetchCapacity();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [date, session?.access_token, fetchCapacity]);

  return { data, loading, error, refetch: fetchCapacity };
}
