import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';

interface StaffAvailability {
  available: boolean;
  shift_name: string;
  start_time: string | null;
  end_time: string | null;
}

/**
 * Fetches staff availability for a given date.
 * Returns a map of user_id -> availability info.
 * Users with no schedule entry are considered "unscheduled" (not in the map).
 * Users with is_day_off=true have available=false.
 */
export function useAvailableStaff(date: string | null) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['available-staff', orgId, date],
    queryFn: async () => {
      if (!orgId || !date) return {};
      const res = await apiInvoke<{
        ok: boolean;
        data: Record<string, StaffAvailability>;
      }>('get-available-staff', {
        body: { organizationId: orgId, date },
      });
      if (res.error || !res.data) return {};
      return res.data.data || {};
    },
    enabled: !!orgId && !!date,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export type { StaffAvailability };
