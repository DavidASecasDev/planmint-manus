/**
 * TimelinePage — PlanMint internal timeline view.
 * Shows Gantt-style vehicle reservation timeline with full interactivity.
 * - Dynamic zoom: 1M / 3M / 6M
 * - Mini-map overview bar
 * - Month selector to jump to any month
 * - Hover shows full client info
 * - Click navigates to reservation detail
 * - Filter by category
 */
import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { apiInvoke } from "@/lib/apiClient";
import { VehicleTimeline, TimelineData, ZoomLevel } from "@/components/timeline/VehicleTimeline";
import { AppLayout } from "@/components/layout/AppLayout";

const ZOOM_DAYS: Record<ZoomLevel, number> = {
  "1M": 37,  // ~1 month + 1 week before
  "3M": 97,  // ~3 months + 1 week before
  "6M": 187, // ~6 months + 1 week before
};

export default function TimelinePage() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("3M");

  // Start date: 1 week before today (fixed)
  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  // End date depends on zoom level
  const endDate = useMemo(() => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + ZOOM_DAYS[zoomLevel]);
    return d;
  }, [startDate, zoomLevel]);

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

  const handleZoomChange = useCallback((zoom: ZoomLevel) => {
    setZoomLevel(zoom);
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
          zoomLevel={zoomLevel}
          onZoomChange={handleZoomChange}
        />
      </div>
    </AppLayout>
  );
}
