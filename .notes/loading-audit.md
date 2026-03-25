# Loading Issues Audit

## Critical Issues Found

### 1. VehicleStatus crash: cleaning_tasks.filter on undefined
- **File**: `client/src/pages/VehicleStatus.tsx:80` and `client/src/components/vehicles/VehicleCard.tsx:38`
- **Cause**: `vehicle.cleaning_tasks` can be undefined when prefetch puts raw data in cache
- **Fix**: Already applied `(vehicle.cleaning_tasks || []).filter(...)` 
- **Status**: FIXED

### 2. Prefetch cache poisoning (CRITICAL)
- **File**: `client/src/hooks/usePrefetch.ts` (old version)
- **Cause**: Prefetch was putting raw Supabase rows into cache keys used by hooks that expect enriched data
- **Fix**: Already rewritten to use invalidation instead of direct prefetch for complex queries
- **Status**: FIXED

### 3. No global ErrorBoundary
- **Impact**: ANY unhandled error crashes the entire app (white screen)
- **Fix needed**: Add ErrorBoundary wrapping routes in App.tsx
- **Status**: TO FIX

### 4. Supabase 400 error on fecha_entrada
- **Cause**: Old PWA service worker caching stale query. No code references fecha_entrada anymore.
- **Fix**: PWA cache issue - need to bust old service worker cache
- **Status**: EXTERNAL (PWA cache)

## Hooks Data Safety Check

| Hook | Defaults to [] | Safe |
|------|---------------|------|
| useVehicles | `vehicles || []` in return | YES |
| useFleetVehicles | `data: vehicles = []` | YES |
| useTransferRequests | `data: requests = []` | YES |
| useBrokerRequests | `data: requests = []`, `data: brokers = []` | YES |
| useTasks | `useState<TaskWithRelations[]>([])` | YES |
| useAreas | `useState<Area[]>([])` | YES |
| useMovements | `movementsQuery.data || []` | YES |

## Remaining Fixes Needed

1. Add global ErrorBoundary to prevent white screens
2. Add null safety to any remaining cleaning_tasks access points
3. Consider adding React Query error retry configuration
