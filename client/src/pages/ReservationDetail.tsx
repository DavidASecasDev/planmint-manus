/**
 * ReservationDetail — Standalone page for viewing a single reservation.
 * Loads reservation by ID from Supabase and displays the detail sheet.
 * Accessed from timeline clicks: /reservations/:id
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { ReservationDetailSheet } from '@/components/reservations/ReservationDetailSheet';
import { Reservation } from '@/types/reservations';
import { supabase } from '@/integrations/supabase/client';

export default function ReservationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(true);

  const { data: reservation, isLoading, error } = useQuery({
    queryKey: ['reservation-detail', id],
    queryFn: async () => {
      if (!id) throw new Error('No reservation ID');
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Reservation;
    },
    enabled: !!id,
  });

  // When sheet is closed, navigate back
  useEffect(() => {
    if (!sheetOpen) {
      navigate(-1);
    }
  }, [sheetOpen, navigate]);

  if (isLoading) {
    return (
      <AppLayout title="Reserva">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !reservation) {
    return (
      <AppLayout title="Reserva">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">
            {error ? 'Error al cargar la reserva' : 'Reserva no encontrada'}
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Reserva ${reservation.external_reservation_id || ''}`}>
      <div className="p-4">
        <Button variant="outline" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al Timeline
        </Button>
      </div>
      <ReservationDetailSheet
        reservation={reservation}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </AppLayout>
  );
}
