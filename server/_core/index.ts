import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleOcrPlate } from "../ocrPlate";
import { handleSyncRently } from "../syncRently";
import { handleAiAssistant } from "../aiAssistant";
import { handleRentlyHub } from "../rentlyHub";
import { handleParseTransferDocument } from "../parseTransferDocument";
import { handleCreateMovementsFromTransfer } from "../createMovementsFromTransfer";
import { handleSignupWithInvitation } from "../signupWithInvitation";
import { handleGetVapidKey } from "../vapidKey";
import { handleApplyTemplate } from "../applyTemplate";
import { handleCreateInvitation } from "../createInvitation";
import {
  handleGetInvitationPublic,
  handleAcceptInvitation,
  handleAcceptMyPendingInvitation,
  handleRevokeInvitation,
  handleGetOrganizationInvitations,
  handleGetMyPendingInvitations,
} from "../invitationEndpoints";
import {
  handleCreateOrganizationWithOwner,
  handleCreateAreaSecure,
  handleCreateTaskSecure,
  handleGetMyPermissions,
} from "../coreEndpoints";
import {
  handleGetInactiveVehicles,
  handleGetOrgIntegrationFlags,
  handleGetNextTransferDocumentNumber,
  handleUpdateVehicleLocation,
  handleGetReservationsOperational,
} from "../coreEndpoints2";
import {
  handleGetMyProfile,
  handleGetMyOrganization,
  handleGetMyOrganizations,
  handleSwitchOrganization,
} from "../authEndpoints";
import {
  handleApproveBrokerRegistration,
  handleRejectBrokerRegistration,
} from "../brokerRegistrationEndpoints";
import { handleRequestBrokerAccess } from "../brokerRequestAccess";
import { handleValidateBrokerInvite } from "../validateBrokerInvite";
import { handlePublicOperations } from "../publicOperationsEndpoint";
import {
  handleGetOrgModules,
  handleGetOrgCustomRoles,
  handleGetRolePermissions,
  handleGetUserPermissionOverrides,
  handleSetUserPermissionOverride,
  handleRemoveUserPermissionOverride,
  handleResetUserPermissionOverrides,
  handleGetOrgMembers,
  handleUpdateMemberRole,
  handleUpdateMemberStatus,
  handleRemoveMember,
  handleManageCustomRole,
  handleToggleRolePermission,
} from "../orgDataEndpoints";
import {
  handleListServiceRequests,
  handleCreateServiceRequest,
  handleResolveServiceRequest,
  handleCancelServiceRequest,
  handleGetAvailableOrgs,
  handleUpdateServiceRequestStatus,
  handleGetServiceRequestDetail,
  handleGetVehicleModels,
  handleUploadServiceRequestDoc,
  serviceRequestDocUpload,
  handleGetAvailableVehicles,
  handleGetServiceRequestHistory,
} from "../serviceRequestEndpoints";
import {
  handleSuperAdminAddMember,
  handleSuperAdminUpdateMemberRole,
  handleSuperAdminUpdateMemberStatus,
  handleSuperAdminRemoveMember,
  handleSuperAdminUpdateOrgStatus,
  handleSuperAdminDeleteOrganization,
  handleSuperAdminUpdateOrgPlan,
  handleSuperAdminUpdateFeedback,
  handleSuperAdminDeleteFeedback,
  handleSuperAdminDeleteTask,
  handleSuperAdminDeleteArea,
  handleSuperAdminGetUserMemberships,
  handleSuperAdminGetUserDetail,
} from "../superAdminEndpoints";
import {
  handleGetShiftTemplates,
  handleCreateShiftTemplate,
  handleUpdateShiftTemplate,
  handleDeleteShiftTemplate,
  handleGetWeeklySchedule,
  handleUpsertSchedule,
  handleBulkUpsertSchedules,
  handleGetAvailableStaff,
  handleReorderTeamMembers,
} from "../scheduleEndpoints";
import { handleGetStaffCapacity } from "../staffCapacityEndpoint";
import {
  handleGetStaffCapacityWeek,
  handleListTravelTimeOverrides,
  handleUpsertTravelTimeOverride,
  handleDeleteTravelTimeOverride,
  handleInvalidateTravelTimeCache,
} from "../staffCapacityWeekEndpoint";
import {
  handleGetUnassignedOperations,
  handleAssignReinforcement,
} from "../reinforcementEndpoint";
import { handlePlacesAutocomplete } from "../placesAutocompleteEndpoint";
import { handleGeocode } from "../geocodeEndpoint";
import { handleEnCaminoTrack, handleEnCaminoList, handleEnCaminoDelete, handleEnCaminoLlego, handleEnCaminoStatus, handleEnCaminoSummary, handleEnCaminoHistory } from "../enCaminoTrackingEndpoint";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ─── Migrated Edge Function endpoints ──────────────────────────────────────
  app.post("/api/ocr-plate", handleOcrPlate);
  app.post("/api/sync-rently", handleSyncRently);
  app.post("/api/ai-assistant", handleAiAssistant);
  app.post("/api/rently-hub", handleRentlyHub);
  app.post("/api/parse-transfer-document", handleParseTransferDocument);
  app.post("/api/create-movements-from-transfer", handleCreateMovementsFromTransfer);
  app.post("/api/signup-with-invitation", handleSignupWithInvitation);
  app.post("/api/get-vapid-key", handleGetVapidKey);
  app.post("/api/apply-template", handleApplyTemplate);
  app.post("/api/create-invitation", handleCreateInvitation);

  // ─── Invitation endpoints (replace broken Supabase RPCs) ───────────────────
  app.post("/api/get-invitation-public", handleGetInvitationPublic);
  app.post("/api/accept-invitation", handleAcceptInvitation);
  app.post("/api/accept-my-pending-invitation", handleAcceptMyPendingInvitation);
  app.post("/api/revoke-invitation", handleRevokeInvitation);
  app.post("/api/get-organization-invitations", handleGetOrganizationInvitations);
  app.post("/api/get-my-pending-invitations", handleGetMyPendingInvitations);

  // ─── Core endpoints (replace broken Supabase RPCs - batch 1) ──────────────
  app.post("/api/create-organization-with-owner", handleCreateOrganizationWithOwner);
  app.post("/api/create-area-secure", handleCreateAreaSecure);
  app.post("/api/create-task-secure", handleCreateTaskSecure);
  app.post("/api/get-my-permissions", handleGetMyPermissions);

  // ─── Core endpoints (replace broken Supabase RPCs - batch 2) ──────────────
  app.post("/api/get-inactive-vehicles", handleGetInactiveVehicles);
  app.post("/api/get-org-integration-flags", handleGetOrgIntegrationFlags);
  app.post("/api/get-next-transfer-document-number", handleGetNextTransferDocumentNumber);
  app.post("/api/update-vehicle-location", handleUpdateVehicleLocation);
  app.post("/api/get-reservations-operational", handleGetReservationsOperational);

  // ─── Auth data endpoints (bypass RLS for profile/org loading) ─────────────
  app.post("/api/get-my-profile", handleGetMyProfile);
  app.post("/api/get-my-organization", handleGetMyOrganization);
  app.post("/api/get-my-organizations", handleGetMyOrganizations);
  app.post("/api/switch-organization", handleSwitchOrganization);

  // ─── Public endpoints (no auth required) ───────────────────────────────────
  app.get("/api/public/operations/:orgSlug", handlePublicOperations);

  // ─── Broker registration endpoints ────────────────────────────────────────
  app.post("/api/validate-broker-invite", handleValidateBrokerInvite); // Public (no auth)
  app.post("/api/request-broker-access", handleRequestBrokerAccess); // Public (no auth)
  app.post("/api/approve-broker-registration", handleApproveBrokerRegistration);
  app.post("/api/reject-broker-registration", handleRejectBrokerRegistration);

  // ─── Org data endpoints (bypass RLS for non-owner users) ──────────────────
  app.post("/api/get-org-modules", handleGetOrgModules);
  app.post("/api/get-org-custom-roles", handleGetOrgCustomRoles);
  app.post("/api/get-role-permissions", handleGetRolePermissions);
  app.post("/api/get-user-permission-overrides", handleGetUserPermissionOverrides);
  app.post("/api/set-user-permission-override", handleSetUserPermissionOverride);
  app.post("/api/remove-user-permission-override", handleRemoveUserPermissionOverride);
  app.post("/api/reset-user-permission-overrides", handleResetUserPermissionOverrides);
  app.post("/api/get-org-members", handleGetOrgMembers);
  app.post("/api/update-member-role", handleUpdateMemberRole);
  app.post("/api/update-member-status", handleUpdateMemberStatus);
  app.post("/api/remove-member", handleRemoveMember);
  app.post("/api/manage-custom-role", handleManageCustomRole);
  app.post("/api/toggle-role-permission", handleToggleRolePermission);

  // ─── Super Admin endpoints (bypass RLS) ────────────────────────────────────
  app.post("/api/super-admin/add-member", handleSuperAdminAddMember);
  app.post("/api/super-admin/update-member-role", handleSuperAdminUpdateMemberRole);
  app.post("/api/super-admin/update-member-status", handleSuperAdminUpdateMemberStatus);
  app.post("/api/super-admin/remove-member", handleSuperAdminRemoveMember);
  app.post("/api/super-admin/update-org-status", handleSuperAdminUpdateOrgStatus);
  app.post("/api/super-admin/delete-organization", handleSuperAdminDeleteOrganization);
  app.post("/api/super-admin/update-org-plan", handleSuperAdminUpdateOrgPlan);
  app.post("/api/super-admin/update-feedback", handleSuperAdminUpdateFeedback);
  app.post("/api/super-admin/delete-feedback", handleSuperAdminDeleteFeedback);
  app.post("/api/super-admin/delete-task", handleSuperAdminDeleteTask);
  app.post("/api/super-admin/delete-area", handleSuperAdminDeleteArea);
  app.post("/api/super-admin/get-user-memberships", handleSuperAdminGetUserMemberships);
  app.post("/api/super-admin/get-user-detail", handleSuperAdminGetUserDetail);

  // Service Requests (cross-org)
  app.post("/api/list-service-requests", handleListServiceRequests);
  app.post("/api/create-service-request", handleCreateServiceRequest);
  app.post("/api/resolve-service-request", handleResolveServiceRequest);
  app.post("/api/cancel-service-request", handleCancelServiceRequest);
  app.post("/api/get-available-orgs", handleGetAvailableOrgs);
  app.post("/api/update-service-request-status", handleUpdateServiceRequestStatus);
  app.post("/api/get-service-request-detail", handleGetServiceRequestDetail);
  app.post("/api/get-vehicle-models", handleGetVehicleModels);
  app.post("/api/upload-service-request-doc", serviceRequestDocUpload, handleUploadServiceRequestDoc);
  app.post("/api/get-available-vehicles", handleGetAvailableVehicles);
  app.post("/api/get-service-request-history", handleGetServiceRequestHistory);

  // Staff Schedules
  app.post("/api/get-shift-templates", handleGetShiftTemplates);
  app.post("/api/create-shift-template", handleCreateShiftTemplate);
  app.post("/api/update-shift-template", handleUpdateShiftTemplate);
  app.post("/api/delete-shift-template", handleDeleteShiftTemplate);
  app.post("/api/get-weekly-schedule", handleGetWeeklySchedule);
  app.post("/api/upsert-schedule", handleUpsertSchedule);
  app.post("/api/bulk-upsert-schedules", handleBulkUpsertSchedules);
  app.post("/api/reorder-team-members", handleReorderTeamMembers);
  app.post("/api/get-available-staff", handleGetAvailableStaff);
  app.post("/api/get-staff-capacity", handleGetStaffCapacity);
  app.post("/api/get-staff-capacity-week", handleGetStaffCapacityWeek);
  app.post("/api/travel-time-overrides/list", handleListTravelTimeOverrides);
  app.post("/api/travel-time-overrides/upsert", handleUpsertTravelTimeOverride);
  app.post("/api/travel-time-overrides/delete", handleDeleteTravelTimeOverride);
  app.post("/api/travel-time-cache/invalidate", handleInvalidateTravelTimeCache);
  app.post("/api/get-unassigned-operations", handleGetUnassignedOperations);
  app.post("/api/assign-reinforcement", handleAssignReinforcement);
  app.post("/api/places-autocomplete", handlePlacesAutocomplete);
  app.post("/api/geocode", handleGeocode);
  app.post("/api/en-camino-tracking", handleEnCaminoTrack);
  app.post("/api/en-camino-tracking/llego", handleEnCaminoLlego);
  app.post("/api/en-camino-tracking/status", handleEnCaminoStatus);
  app.post("/api/en-camino-tracking/summary", handleEnCaminoSummary);
  app.post("/api/en-camino-tracking/history", handleEnCaminoHistory);
  app.get("/api/en-camino-tracking", handleEnCaminoList);
  app.delete("/api/en-camino-tracking", handleEnCaminoDelete);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
