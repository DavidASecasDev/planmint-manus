/**
 * TimelinePage — PlanMint internal timeline view.
 * Shows Gantt-style vehicle reservation timeline with full interactivity.
 * - Hover shows full client info
 * - Click navigates to reservation detail
 * - Filter by category
 * - Navigate through time with < Hoy > controls
 */
import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { apiInvoke } from "@/lib/apiClient";
import { VehicleTimeline, TimelineData } from "@/components/timeline/VehicleTimeline";
import { AppLayout } from "@/components/layout/AppLayout";

export default function TimelinePage() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });

  const endDate = useMemo(() => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + 35); // 5 weeks view
    return d;
  }, [startDate]);

  const fromStr = startDate.toISOString().split("T")[0];
  const toStr = endDate.toISOString().split("T")[0];

  // Fetch timeline data from authenticated endpoint with date range
  const { data, isLoading, error } = useQuery<TimelineData>({
    queryKey: ["timeline", fromStr, toStr],
    queryFn: async () => {
      const result = await apiInvoke<TimelineData>(`timeline?from=${fromStr}&to=${toStr}`);
      if (result.error) throw new Error(result.error.message);
      return result.data!;
    },
    staleTime: 60_000, // 1 min cache
    refetchInterval: 5 * 60_000, // Auto-refresh every 5 min
  });

  const handleReservationClick = useCallback((reservationId: string) => {
    window.open(`/reservations/${reservationId}`, '_blank');
  }, []);

  const handleNavigate = useCallback((direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d);
    } else {
      setStartDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + (direction === "next" ? 7 : -7));
        return d;
      });
    }
  }, []);

  return (
    <AppLayout title="Timeline" fullWidth>
      <div className="flex flex-col gap-4 p-2 sm:p-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Timeline de Reservas</h1>
            <p className="text-sm text-muted-foreground">
              Vista Gantt de ocupación de vehículos por categoría
            </p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Error al cargar el timeline: {(error as Error).message}
          </div>
        )}

        {/* Timeline */}
        <VehicleTimeline
          data={data || null}
          isLoading={isLoading}
          interactive={true}
          onReservationClick={handleReservationClick}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          onNavigate={handleNavigate}
        />
      </div>
    </AppLayout>
  );
}
