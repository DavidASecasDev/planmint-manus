# Tab-Switch Refresh Bug Analysis

## Root Causes Identified

### 1. AuthContext visibilitychange handler (PRIMARY SUSPECT)
- File: `client/src/contexts/AuthContext.tsx` line 363-378
- On EVERY tab return (`visibilityState === 'visible'`), calls `supabase.auth.refreshSession()`
- This triggers Supabase `onAuthStateChange` with `TOKEN_REFRESHED` event
- While TOKEN_REFRESHED is skipped for profile reload, the `refreshSession()` call itself can:
  - Fail if token is slightly stale → triggers signOut → redirect to /login
  - Cause a brief loading state in ProtectedRoute → flash/remount
  - The refreshSession() call is async and can race with other auth state changes

### 2. OfflineBanner invalidateQueries() on reconnect
- File: `client/src/components/offline/OfflineBanner.tsx` line 36
- When `wasOffline && isOnline`, calls `queryClient.invalidateQueries()` (ALL queries!)
- Some browsers fire offline/online events when switching tabs (especially mobile)
- This causes ALL queries to refetch simultaneously, which can:
  - Trigger loading states across the app
  - Cause forms to lose state if they depend on query data

### 3. refetchOnReconnect: 'always' in QueryClient
- File: `client/src/App.tsx` line 175
- Combined with #2, when browser fires online event on tab return, ALL queries refetch

### 4. Supabase autoRefreshToken: true
- File: `client/src/integrations/supabase/client.ts` line 16
- Supabase SDK automatically refreshes tokens, which can fire TOKEN_REFRESHED
- Combined with the visibilitychange handler, this creates double-refresh scenarios

## Fix Plan

1. **AuthContext**: Debounce/throttle the visibilitychange handler. Don't refresh if last refresh was < 5 minutes ago.
2. **OfflineBanner**: Don't invalidate ALL queries on reconnect. Only invalidate if actually offline for > 10 seconds.
3. **QueryClient**: Change refetchOnReconnect to false or 'stale' (only refetch stale queries).
4. **General**: Add a guard against rapid online/offline transitions that browsers sometimes fire on tab switch.
