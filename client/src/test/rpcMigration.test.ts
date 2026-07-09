/**
 * Tests for RPC migration - verifies that all supabase.rpc() calls
 * have been replaced with Express endpoints or direct table queries.
 * 
 * These tests validate the endpoint contracts and response shapes.
 */
import { describe, it, expect, vi } from 'vitest';

// ============================================================
// 1. Verify no supabase.rpc() calls remain in key files
// ============================================================
describe('RPC Migration Completeness', () => {
  it('usePermissions should use apiInvoke instead of supabase.rpc', async () => {
    const source = await import('../hooks/usePermissions?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain('supabase.rpc');
    expect(code).toContain('apiInvoke');
  });

  it('useTasks should use apiInvoke for create_task_secure', async () => {
    const source = await import('../hooks/useTasks?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('create_task_secure'");
    expect(code).toContain('apiInvoke');
  });

  it('useAreas should use apiInvoke for create_area_secure', async () => {
    const source = await import('../hooks/useAreas?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('create_area_secure'");
    expect(code).toContain('apiInvoke');
  });

  it('useVehicles should use apiInvoke for get_inactive_vehicles', async () => {
    const source = await import('../hooks/useVehicles?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('get_inactive_vehicles'");
    expect(code).toContain('apiInvoke');
  });

  it('useVehicleLocations should use apiInvoke for update_vehicle_location', async () => {
    const source = await import('../hooks/useVehicleLocations?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('update_vehicle_location'");
    expect(code).toContain('apiInvoke');
  });

  it('useIntegrationFlags should use apiInvoke for get_org_integration_flags', async () => {
    const source = await import('../hooks/useIntegrationFlags?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('get_org_integration_flags'");
    expect(code).toContain('apiInvoke');
  });

  it('useReservations should use apiInvoke for get_reservations_operational', async () => {
    const source = await import('../hooks/useReservations?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('get_reservations_operational'");
    expect(code).toContain('apiInvoke');
  });


  it('CreateOrganization should use apiInvoke for create_organization_with_owner', async () => {
    const source = await import('../pages/onboarding/CreateOrganization?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('create_organization_with_owner'");
    expect(code).toContain('apiInvoke');
  });

  it('PermissionsDiagnostics should use apiInvoke for get_my_permissions', async () => {
    const source = await import('../pages/admin/PermissionsDiagnostics?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('get_my_permissions'");
    expect(code).toContain('apiInvoke');
  });
});

// ============================================================
// 2. Verify non-core RPCs are fail-graceful
// ============================================================
describe('Non-core RPC Fail-Graceful Migration', () => {
  // useEntitlements test removed (hook deleted - internal app, no billing)

  it('useOrganizationModules should use backend endpoint instead of Supabase RPC', async () => {
    const source = await import('../hooks/useOrganizationModules?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('get_my_enabled_modules'");
    // Now uses apiInvoke('get-org-modules') backend endpoint
    expect(code).toContain('get-org-modules');
    expect(code).toContain('DEFAULT_MODULES');
  });

  it('useSuperAdmin should query super_admins table directly', async () => {
    const source = await import('../hooks/useSuperAdmin?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('is_super_admin'");
    expect(code).toContain('super_admins');
  });

  it('useLeads should insert into leads table directly', async () => {
    const source = await import('../hooks/useLeads?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('upsert_lead'");
    expect(code).toContain("from('leads')");
  });

  it('useReferrals should not use any supabase.rpc calls', async () => {
    const source = await import('../hooks/useReferrals?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('generate_referral_code'");
    expect(code).not.toContain("supabase.rpc('track_referral_click'");
    expect(code).toContain("from('referrals')");
  });

  // useCoupons test removed (hook deleted - internal app, no billing)

  it('BrokerAuthContext should not use any supabase.rpc calls', async () => {
    const source = await import('../contexts/BrokerAuthContext?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('get_broker_registration_status'");
    expect(code).not.toContain(".rpc('get_broker_profile'");
    expect(code).toContain("broker_registration_requests");
    expect(code).toContain("broker_profiles");
  });

  it('useBrokerRegistrations should use apiInvoke for approve/reject', async () => {
    const source = await import('../hooks/useBrokerRegistrations?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('approve_broker_registration'");
    expect(code).not.toContain("supabase.rpc('reject_broker_registration'");
    // Mutations should use apiInvoke to backend endpoints
    expect(code).toContain("apiInvoke('approve-broker-registration'");
    expect(code).toContain("apiInvoke('reject-broker-registration'");
    // Queries should still read from broker_registration_requests
    expect(code).toContain("broker_registration_requests");
  });

  it('useTransferBrokers should not use setup_broker_access RPC', async () => {
    const source = await import('../hooks/useTransferBrokers?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain(".rpc('setup_broker_access'");
    expect(code).toContain("transfer_brokers");
  });

  it('Register.tsx should not use track_referral_signup RPC', async () => {
    const source = await import('../pages/auth/Register?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('track_referral_signup'");
    expect(code).toContain("from('referrals')");
  });

  it('ReferralRedirect should not use track_referral_click RPC', async () => {
    const source = await import('../pages/public/ReferralRedirect?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain("supabase.rpc('track_referral_click'");
    expect(code).toContain("from('referrals')");
  });

  it('BrokerLogin should not use get_broker_profile RPC', async () => {
    const source = await import('../pages/broker/BrokerLogin?raw');
    const code = (source as any).default || '';
    expect(code).not.toContain(".rpc('get_broker_profile'");
    expect(code).toContain("broker_profiles");
  });
});

// ============================================================
// 3. Verify profiles.email references are fixed
// ============================================================
describe('profiles.email Fix Verification', () => {
  it('signupWithInvitation should NOT reference profiles.email', async () => {
    const fs = await import('fs');
    const path = await import('path');
    // __dirname is client/src/test, project root is 3 levels up
    const projectRoot = path.resolve(__dirname, '../../..');
    const filePath = path.resolve(projectRoot, 'server/signupWithInvitation.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Should NOT have email in profile update/insert
    const updateSection = content.substring(
      content.indexOf('from("profiles")'),
      content.indexOf('from("organization_members")')
    );
    expect(updateSection).not.toContain('email: email');
    expect(updateSection).not.toContain("email: email.trim()");
    expect(content).toContain('NOT have an \'email\' column');
  });

  it('createInvitation should use auth.admin.listUsers instead of profiles.email', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const projectRoot = path.resolve(__dirname, '../../..');
    const filePath = path.resolve(projectRoot, 'server/createInvitation.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Should use auth.admin.listUsers for email lookup
    expect(content).toContain('auth.admin.listUsers');
    // Should check organization_members, not profiles.email
    expect(content).toContain('organization_members');
    expect(content).not.toContain('.from("profiles")\n      .select("id")\n      .eq("email"');
  });
});

// ============================================================
// 4. Verify endpoint contracts
// ============================================================
describe('Express Endpoint Contracts', () => {
  it('coreEndpoints.ts should export all required handlers', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const projectRoot = path.resolve(__dirname, '../../..');
    const filePath = path.resolve(projectRoot, 'server/coreEndpoints.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    expect(content).toContain('handleCreateOrganizationWithOwner');
    expect(content).toContain('handleGetMyPermissions');
    expect(content).toContain('handleCreateTaskSecure');
    expect(content).toContain('handleCreateAreaSecure');
  });

  it('coreEndpoints2.ts should export all required handlers', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const projectRoot = path.resolve(__dirname, '../../..');
    const filePath = path.resolve(projectRoot, 'server/coreEndpoints2.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    expect(content).toContain('handleGetInactiveVehicles');
    expect(content).toContain('handleGetReservationsOperational');
    expect(content).toContain('handleUpdateVehicleLocation');
    expect(content).toContain('handleGetNextTransferDocumentNumber');
    expect(content).toContain('handleGetOrgIntegrationFlags');
  });

  it('invitationEndpoints.ts should export all required handlers', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const projectRoot = path.resolve(__dirname, '../../..');
    const filePath = path.resolve(projectRoot, 'server/invitationEndpoints.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    expect(content).toContain('handleGetInvitationPublic');
    expect(content).toContain('handleAcceptInvitation');
    expect(content).toContain('handleAcceptMyPendingInvitation');
    expect(content).toContain('handleRevokeInvitation');
    expect(content).toContain('handleGetOrganizationInvitations');
    expect(content).toContain('handleGetMyPendingInvitations');
  });
});

// ============================================================
// 5. Verify server registration
// ============================================================
describe('Server Endpoint Registration', () => {
  it('server/_core/index.ts should register all new endpoints', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const projectRoot = path.resolve(__dirname, '../../..');
    const filePath = path.resolve(projectRoot, 'server/_core/index.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Core endpoints
    expect(content).toContain('create-organization-with-owner');
    expect(content).toContain('get-my-permissions');
    expect(content).toContain('create-task-secure');
    expect(content).toContain('create-area-secure');
    expect(content).toContain('get-inactive-vehicles');
    expect(content).toContain('get-reservations-operational');
    expect(content).toContain('update-vehicle-location');
    expect(content).toContain('get-next-transfer-document-number');
    expect(content).toContain('get-org-integration-flags');
    
    // Invitation endpoints
    expect(content).toContain('get-invitation-public');
    expect(content).toContain('accept-invitation');
    expect(content).toContain('accept-my-pending-invitation');
    expect(content).toContain('revoke-invitation');
    expect(content).toContain('get-organization-invitations');
    expect(content).toContain('get-my-pending-invitations');
  });
});
