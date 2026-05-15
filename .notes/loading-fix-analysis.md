# Loading Issues Root Cause Analysis — May 2026

## Symptoms
1. Dashboard stays in skeleton state (gray placeholders) until manual reload
2. Horarios shows "No hay equipos configurados" when data exists
3. Various pages require manual reload to display data

## Root Causes Identified

### RC1: refetchOnReconnect: false + refetchOnWindowFocus: false
**Impact: HIGH — affects ALL pages**
- `App.tsx:185` sets `refetchOnReconnect: false` and `refetchOnWindowFocus: false`
- When a user's connection drops briefly (mobile, WiFi switch), queries that failed or were stale do NOT automatically retry
- The comment says "OfflineBanner handles reconnect invalidation with duration guard" but this is unreliable
- Combined with `retry: 1`, a single transient failure means the query stays failed/empty until manual reload
- **Fix**: Enable `refetchOnReconnect: true` (safe, only refetches stale queries), keep `refetchOnWindowFocus: false`

### RC2: Permissions race condition in Schedules
**Impact: MEDIUM — affects Horarios specifically**
- `Schedules.tsx` calls `hasPermission('schedules.view')` immediately at render time
- During auth initialization, `usePermissions()` returns `isLoading: true` and `hasPermission()` returns `false`
- But Schedules.tsx does NOT check `isLoading` from usePermissions
- If the page renders before permissions are loaded, it may show empty state
- The weekly-schedule query depends on `!!orgId` which is also null during auth init
- **Fix**: Check `isLoading` from usePermissions and show skeleton during that time

### RC3: Dashboard query can fail silently on auth race
**Impact: MEDIUM — affects Dashboard**
- `useOperationalDashboard` is gated by `!!orgId && sessionReady`
- But if `sessionReady` flips to true before profile is fully loaded (edge case), orgId is still null
- The query stays disabled forever until something triggers a re-render
- Also: `retry: 1` means if the first attempt fails (e.g., Supabase rate limit), it gives up quickly
- **Fix**: Increase retry to 2, add refetchOnReconnect

### RC4: Supabase token refresh causes brief auth gap
**Impact: LOW-MEDIUM**
- TOKEN_REFRESHED is correctly handled (no profile reload)
- But SIGNED_IN from tab visibility can still cause issues if `lastFetchedUserId` check fails
- The 401 retry in apiClient.ts handles most cases, but direct Supabase queries don't benefit from this

## Recommended Fixes (Priority Order)
1. Enable `refetchOnReconnect: true` in QueryClient defaults
2. Add `refetchOnWindowFocus: 'always'` for critical queries (permissions, dashboard)
3. Add loading guard in Schedules.tsx for permissions
4. Increase global retry to 2 with smarter retry logic
5. Add a global "stale data" recovery: invalidate all queries after prolonged inactivity
