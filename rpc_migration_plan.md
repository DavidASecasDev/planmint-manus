# RPC Migration Plan - Steps 2 & 3

## RPCs that EXIST in Supabase (no migration needed):
- `generate_referral_code` - useReferrals.ts
- `get_my_enabled_modules` - useOrganizationModules.ts
- `get_my_pending_invitations` - (already migrated to Express in Step 1)
- `get_organization_entitlements` - useEntitlements.ts
- `get_organization_invitations` - (already migrated to Express in Step 1)
- `is_super_admin` - useSuperAdmin.ts
- `sync_vehicles_from_reservations` - useVehicles.ts, SyncRentlyDialog.tsx, RentlySyncContext.tsx

## RPCs that DON'T EXIST (need Express endpoints - Prioridad 2 CORE):
1. `create_organization_with_owner` - CreateOrganization.tsx - Superadmin crea orgs
2. `create_task_secure` - useTasks.ts - Crear tareas
3. `get_my_permissions` - usePermissions.ts, PermissionsDiagnostics.tsx - Sistema permisos
4. `get_inactive_vehicles` - useVehicles.ts - Ver vehículos inactivos
5. `get_org_integration_flags` - useIntegrationFlags.ts - Flags de integración
6. `get_next_transfer_document_number` - useTransferQuotePdf.ts - Numeración docs
7. `update_vehicle_location` - useVehicleLocations.ts - Ubicación vehículos
8. `debug_areas_insert_permission` - PermissionsDiagnostics.tsx - Debug permisos

## RPCs that DON'T EXIST (Módulos no-core - Prioridad 4):
9. `get_broker_registration_status` - BrokerAuthContext.tsx
10. `approve_broker_registration` - useBrokerRegistrations.ts
11. `reject_broker_registration` - useBrokerRegistrations.ts
12. `get_broker_profile` - BrokerLogin.tsx
13. `track_referral_click` - useReferrals.ts, ReferralRedirect.tsx
14. `track_referral_signup` - Register.tsx
15. `redeem_coupon_for_plan` - useCoupons.ts
16. `upsert_lead` - useLeads.ts

## Strategy:
- CORE RPCs (1-8): Create Express endpoints with Supabase service client
- NON-CORE RPCs (9-16): Make them fail gracefully (no-op with console.warn)
  These modules (Broker, Referrals, Coupons, Leads) are not actively used.
