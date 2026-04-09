# Root Cause Found

## The Supabase SDK itself fires SIGNED_IN on every tab return

In `@supabase/auth-js@2.99.3`, the `_recoverAndRefresh()` method (line 2847) fires:
```
await this._notifyAllSubscribers('SIGNED_IN', currentSession)
```

This happens EVERY TIME the tab becomes visible (via the SDK's own visibilitychange handler at line 3234-3261).

Even when the session is NOT expired, it still fires `SIGNED_IN`.

## Chain of events:
1. User switches tab → Supabase SDK stops auto-refresh
2. User returns to tab → Supabase SDK's visibilitychange fires
3. SDK calls `_recoverAndRefresh()` → fires `SIGNED_IN` event
4. AuthContext.tsx `handleSession('SIGNED_IN', session)` receives this
5. Since it's NOT `TOKEN_REFRESHED` and NOT `INITIAL_SESSION`, it calls `loadUserData()`
6. `loadUserData()` sets `setProfileLoading(true)` (line 225)
7. ProtectedRoute sees `profileLoading === true` → shows full-screen spinner
8. All children unmount → form state is lost
9. Profile loads → `setProfileLoading(false)` → children remount from scratch

## Fix:
In handleSession, also skip profile reload for SIGNED_IN events when the user hasn't changed.
The key insight: if `currentSession.user.id === user.id` (same user), we should NOT reload the profile.
Only reload profile on SIGNED_IN if it's a different user or first load.
