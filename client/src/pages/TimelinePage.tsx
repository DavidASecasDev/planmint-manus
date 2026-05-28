/**
 * TimelinePage — PlanMint internal timeline view.
 * Shows Gantt-style vehicle reservation timeline with full interactivity.
 * - Hover shows full client info
 * - Click navigates to reservation detail
 * - Filter by category
 */
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { apiInvoke } from "@/lib/apiClient";
import { VehicleTimeline, TimelineData } from "@/components/timeline/VehicleTimeline";
import { AppLayout } from "@/components/layout/AppLayout";

export default function TimelinePage() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Fetch timeline data from authenticated endpoint
  const { data, isLoading, error } = useQuery<TimelineData>({
    queryKey: ["timeline"],
    queryFn: async () => {
      const result = await apiInvoke<TimelineData>("timeline");
      if (result.error) throw new Error(result.error.message);
      return result.data!;
    },
    staleTime: 60_000, // 1 min cache
    refetchInterval: 5 * 60_000, // Auto-refresh every 5 min
  });

  const handleReservationClick = useCallback((reservationId: string) => {
    window.open(`/reservations/${reservationId}`, '_blank');
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
        />
      </div>
    </AppLayout>
  );
}
