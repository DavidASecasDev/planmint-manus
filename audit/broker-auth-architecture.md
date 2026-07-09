# Broker Auth Architecture Analysis

## Current State

### Authentication Layer
Both PlanMint users and Brokers use **the same Supabase Auth instance** (same `auth.users` table).

### PlanMint Users (main app)
- Login via `/login` page
- Auth managed by `AuthContext.tsx` → `supabase.auth.signInWithPassword()`
- Profile stored in `profiles` table (linked by `user_id`)
- Has `organization_id` and `role` (owner/admin/manager/member/read_only)
- Routes under `/*` (MainAppRoutes)

### Broker Users (portal)
- Login via `/broker/login` page
- Auth managed by `BrokerAuthContext.tsx` → same `supabase.auth.signInWithPassword()`
- Profile stored in `broker_profiles` table (linked by `user_id`)
- Has `broker_id` (FK to `transfer_brokers`), `organization_id`
- Routes under `/broker/*` (BrokerPortalRoutes)

### How Broker Accounts Are Created
1. Admin generates invite link (`/api/validate-broker-invite`)
2. Broker visits `/broker/register?invite=CODE`
3. Server creates a **Supabase Auth user** via `sb.auth.admin.createUser()` (in `brokerRequestAccess.ts`)
4. Inserts row in `broker_registration_requests` (status: pending)
5. Admin approves → creates `transfer_brokers` row + `broker_profiles` row

### The Conflict Problem
Since both systems share the SAME Supabase Auth:
- A broker and a PlanMint employee CANNOT use the same email
- If a PlanMint employee logs into `/broker/login`, the BrokerLogin page detects they're not a broker and signs them out (`clearNonBrokerSession`)
- If a broker navigates to the main app, they'd be signed in but have no `profiles` row → broken state
- **The session cookie is shared** — logging into one portal logs you out of the other

### Tables Involved
- `auth.users` — shared Supabase Auth (email/password)
- `profiles` — PlanMint user profiles (one per auth user)
- `broker_profiles` — Broker portal profiles (one per auth user)
- `transfer_brokers` — Broker business entity (can exist without a user account)
- `broker_registration_requests` — Pending/approved/rejected registrations

### Key Conflict Scenarios
1. **Employee wants broker access**: Can't register with same email → "already exists" error
2. **Shared session**: Login to broker portal signs out of main app (same Supabase session)
3. **BrokerLogin.clearNonBrokerSession**: If user has no broker_profiles row, it signs them out

## Proposed Solution: Dual-Profile Model

Instead of creating separate auth users, allow ONE Supabase Auth user to have BOTH:
- A `profiles` row (PlanMint access)
- A `broker_profiles` row (Broker portal access)

### Changes Required:
1. **BrokerLogin.clearNonBrokerSession** — Remove the signOut for non-broker users. Instead, check if they have a broker_profiles row and if not, show "no access" without destroying their session.
2. **BrokerAuthContext** — Don't sign out if no broker profile found. Just set isBroker=false.
3. **AuthContext** — Don't sign out if navigating to broker routes.
4. **Registration flow** — When an existing PlanMint user wants broker access, skip createUser (user already exists), just create the registration request with their existing user_id.
5. **Approval flow** — When approving, if user already has a profiles row, just add broker_profiles without touching auth.
6. **Session isolation** — Both portals can coexist because they read different profile tables. The Supabase session stays alive for both.

### Benefits:
- Same email works for both portals
- No session conflicts (one login works for both)
- Employee can switch between main app and broker portal seamlessly
- No data duplication in auth.users
