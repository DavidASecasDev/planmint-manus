import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleOcrPlate } from "../ocrPlate";
import { handleSyncRently } from "../syncRently";
import { handleAiAssistant } from "../aiAssistant";
import { handleRentlyHub } from "../rentlyHub";
import { handleRentlyActions } from "../rentlyActions";
import { handleParseTransferDocument } from "../parseTransferDocument";
import { handleCreateMovementsFromTransfer } from "../createMovementsFromTransfer";
import { handleSignupWithInvitation } from "../signupWithInvitation";
import { handleGetVapidKey } from "../vapidKey";
import { handleApplyTemplate } from "../applyTemplate";
import { handleCreateInvitation } from "../createInvitation";
import { handleCreateUser } from "../createUser";
import { handleResetMemberPassword } from "../resetMemberPassword";
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
import { handleGetTransferBrokers } from "../brokerListEndpoint";
import { handleSupabaseQuery } from "../supabaseProxy";
import { handleGetOperationalDashboard } from "../dashboardEndpoint";
import { handleValidateBrokerInvite } from "../validateBrokerInvite";
import { handlePublicOperations } from "../publicOperationsEndpoint";
import { handlePublicPreparation } from "../publicPreparationEndpoint";
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
  handleSuperAdminResetPassword,
  handleSuperAdminCreateUser,
  handleSuperAdminDeleteUser,
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
  handleSwapUserSchedules,
  handleRotateUserSchedules,
  handleGetScheduleNotes,
  handleUpsertScheduleNote,
  handleDeleteScheduleNote,
  handleGetScheduleNoteHistory,
  handleGetWeekPublishStatus,
  handlePublishWeek,
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
import { handleTransferRouteEstimate } from "../transferRouteEstimateEndpoint";
import { handleGeocode } from "../geocodeEndpoint";
import { handleGeocodeCacheLookup, handleGeocodeCacheSave, handleGeocodeCacheManualSet } from "../geocodeCacheEndpoint";
import { handleEnCaminoTrack, handleEnCaminoList, handleEnCaminoDelete, handleEnCaminoLlego, handleEnCaminoStatus, handleEnCaminoSummary, handleEnCaminoHistory, handleEnCaminoLocation, handleEnCaminoLocationStop, handleEnCaminoLocationHistory, handleEnCaminoStats, handlePublicTrack, handleGetShareToken, handlePublicTrackEta } from "../enCaminoTrackingEndpoint";
import { handleFireTransferAutomation } from "../transferAutomationEndpoint";
import { handleScheduledLostFoundExpiry } from "../scheduledLostFoundExpiry";
import { handleScheduledRentlyPoll } from "../scheduledRentlyPoll";
import { handleScheduledRentlyEnrich } from "../scheduledRentlyEnrich";
import { handleScheduledGeofenceCheck } from "../scheduledGeofenceCheck";
import { handlePublicTimeline, handleAuthenticatedTimeline } from "../timelineEndpoint";
import { handleRepairServiceSync } from "../repairServiceSync";
import {
  handleMovementsStart,
  handleMovementsEnd,
  handleMovementsCancel,
  handleMovementsActive,
  handleMovementsMine,
  handleMovementsGetById,
  handleMovementsUploadPhoto,
} from "../movementsEndpoint";
import { handleRepairRentlyPoll } from "../repairRentlyPoll";
import { handleGetReservationStatusHistory, handleLogReservationStatusChange, handleGetReactivatedReservationIds, handleGetReactivatedReservations } from "../reservationHistoryEndpoint";
import { handleLogManualMovementEdit, handleGetManualMovementHistory } from "../manualMovementHistoryEndpoint";
import {
  handleGetPreparationList,
  handleAddPreparationItem,
  handleCompletePreparationItem,
  handleUncompletePreparationItem,
  handleDeletePreparationItem,
  handleUpdatePreparationItem,
} from "../preparationEndpoints";
import {
  handleGetPreparationProgress,
  handleStartPreparation,
} from "../preparationProgressEndpoints";
import { handleGetPreparationHistory } from "../preparationHistoryEndpoints";
import {
  handleGetProductCategories,
  handleCreateProductCategory,
  handleUpdateProductCategory,
  handleDeleteProductCategory,
  handleGetShortageReports,
  handleGetShortageReportsCount,
  handleCreateShortageReport,
  handleResolveShortageReport,
  handleUnresolveShortageReport,
  handleDeleteShortageReport,
  handleGetHabitualProducts,
  handleCreateHabitualProduct,
  handleUpdateHabitualProduct,
  handleDeleteHabitualProduct,
} from "../productStockEndpoints";
import {
  handleGpsTestConnection,
  handleGpsDevices,
  handleGpsPositions,
  handleGpsDevicePosition,
  handleGpsLinkDevice,
  handleGpsUnlinkDevice,
  handleGpsSettings,
  handleGpsVehicleByPlate,
  handleGpsRouteHistory,
  handleGpsFleetStatus,
  handleGpsFleetDailyKm,
} from "../gpsEndpoint";
import {
  handleXexunPush,
  handleXexunPushGps,
  handleXexunPushObd,
  handleXexunPushAlarm,
} from "../xexunWebhookEndpoint";
import {
  handleListGeofences,
  handleCreateGeofence,
  handleUpdateGeofence,
  handleDeleteGeofence,
} from "../geofenceEndpoints";
import {
  handleGetParkingZones,
  handleCreateParkingZone,
  handleDeleteParkingZone,
  handleGetParkingSpots,
  handleCreateParkingSpotsBulk,
  handleAssignParkingSpot,
  handleReleaseParkingSpot,
  handleGetParkingHistory,
  handleGetParkingOverview,
  handleSeedParkingLayout,
} from "../parkingEndpoints";
import notificationTriggerRouter from "../notificationTriggerEndpoint";
import { handleChangeVehicleStatus, handleGetVehicleStatusHistory } from "../vehicleStatusChangeEndpoint";


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
  // Storage proxy for /manus-storage/* paths
  registerStorageProxy(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ─── Migrated Edge Function endpoints ──────────────────────────────────────
  app.post("/api/ocr-plate", handleOcrPlate);
  app.post("/api/sync-rently", handleSyncRently);
  app.post("/api/ai-assistant", handleAiAssistant);
  app.post("/api/rently-hub", handleRentlyHub);
  app.post("/api/rently-actions", handleRentlyActions);
  app.post("/api/repair-service-sync", handleRepairServiceSync);
  app.post("/api/repair-rently-poll", handleRepairRentlyPoll);
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
  app.post("/api/change-vehicle-status", handleChangeVehicleStatus);
  app.post("/api/get-vehicle-status-history", handleGetVehicleStatusHistory);
  app.post("/api/get-reservations-operational", handleGetReservationsOperational);
  app.post("/api/get-operational-dashboard", handleGetOperationalDashboard);

  // ─── Auth data endpoints (bypass RLS for profile/org loading) ─────────────
  app.post("/api/get-my-profile", handleGetMyProfile);
  app.post("/api/get-my-organization", handleGetMyOrganization);
  app.post("/api/get-my-organizations", handleGetMyOrganizations);
  app.post("/api/switch-organization", handleSwitchOrganization);

  // ─── Public endpoints (no auth required) ───────────────────────────────────
  app.get("/api/public/operations/:orgSlug", handlePublicOperations);
  app.get("/api/public/preparacion", handlePublicPreparation);
  app.get("/api/public/operations/:orgSlug/timeline", handlePublicTimeline);
  app.post("/api/timeline", handleAuthenticatedTimeline);

  // ─── Broker registration endpoints ────────────────────────────────────────
  app.post("/api/validate-broker-invite", handleValidateBrokerInvite); // Public (no auth)
  app.post("/api/request-broker-access", handleRequestBrokerAccess); // Public (no auth)
  app.post("/api/approve-broker-registration", handleApproveBrokerRegistration);
  app.post("/api/reject-broker-registration", handleRejectBrokerRegistration);
  app.post("/api/get-transfer-brokers", handleGetTransferBrokers);
  app.post("/api/supabase-query", handleSupabaseQuery);

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
  app.post("/api/super-admin/reset-password", handleSuperAdminResetPassword);
  app.post("/api/super-admin/create-user", handleSuperAdminCreateUser);
  app.post("/api/super-admin/delete-user", handleSuperAdminDeleteUser);

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
  app.post("/api/swap-user-schedules", handleSwapUserSchedules);
  app.post("/api/rotate-user-schedules", handleRotateUserSchedules);
  app.post("/api/get-week-publish-status", handleGetWeekPublishStatus);
  app.post("/api/publish-week", handlePublishWeek);
  app.post("/api/get-schedule-notes", handleGetScheduleNotes);
  app.post("/api/upsert-schedule-note", handleUpsertScheduleNote);
  app.post("/api/delete-schedule-note", handleDeleteScheduleNote);
  app.post("/api/get-schedule-note-history", handleGetScheduleNoteHistory);
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
  app.post("/api/transfer-route-estimate", handleTransferRouteEstimate);
  app.post("/api/geocode", handleGeocode);
  app.post("/api/geocode-cache/lookup", handleGeocodeCacheLookup);
  app.post("/api/geocode-cache/save", handleGeocodeCacheSave);
  app.post("/api/geocode-cache/manual-set", handleGeocodeCacheManualSet);
  app.post("/api/en-camino-tracking", handleEnCaminoTrack);
  app.post("/api/en-camino-tracking/llego", handleEnCaminoLlego);
  app.post("/api/en-camino-tracking/status", handleEnCaminoStatus);
  app.post("/api/en-camino-tracking/summary", handleEnCaminoSummary);
  app.post("/api/en-camino-tracking/history", handleEnCaminoHistory);
  app.post("/api/en-camino-tracking/location", handleEnCaminoLocation);
  app.post("/api/en-camino-tracking/location-stop", handleEnCaminoLocationStop);
  app.post("/api/en-camino-tracking/location-history", handleEnCaminoLocationHistory);
  app.post("/api/en-camino-tracking/stats", handleEnCaminoStats);
  app.get("/api/en-camino-tracking", handleEnCaminoList);
  app.delete("/api/en-camino-tracking", handleEnCaminoDelete);
  app.post("/api/en-camino-tracking/share-token", handleGetShareToken);
  app.get("/api/track/:token", handlePublicTrack); // Public — no auth required
  app.get("/api/track/:token/eta", handlePublicTrackEta); // Public — dynamic ETA

  // Movements API (Android + Web)
  app.post("/api/movements/start", handleMovementsStart);
  app.post("/api/movements/end", handleMovementsEnd);
  app.post("/api/movements/cancel", handleMovementsCancel);
  app.get("/api/movements/active", handleMovementsActive);
  app.get("/api/movements/mine", handleMovementsMine);
  app.get("/api/movements/:id", handleMovementsGetById);
  app.post("/api/movements/upload-photo", handleMovementsUploadPhoto);

  // User management
  app.post("/api/create-user", handleCreateUser);
  app.post("/api/reset-member-password", handleResetMemberPassword);

  // Preparation list (manual)
  app.post("/api/get-preparation-list", handleGetPreparationList);
  app.post("/api/add-preparation-item", handleAddPreparationItem);
  app.post("/api/complete-preparation-item", handleCompletePreparationItem);
  app.post("/api/uncomplete-preparation-item", handleUncompletePreparationItem);
  app.post("/api/delete-preparation-item", handleDeletePreparationItem);
  app.post("/api/update-preparation-item", handleUpdatePreparationItem);

  // Preparation progress (module)
  app.post("/api/get-preparation-progress", handleGetPreparationProgress);
  app.post("/api/start-preparation", handleStartPreparation);
  app.post("/api/get-preparation-history", handleGetPreparationHistory);

  // Product stock management
  app.post("/api/product-categories", handleGetProductCategories);
  app.post("/api/create-product-category", handleCreateProductCategory);
  app.post("/api/update-product-category", handleUpdateProductCategory);
  app.post("/api/delete-product-category", handleDeleteProductCategory);
  app.post("/api/product-shortage-reports", handleGetShortageReports);
  app.post("/api/product-shortage-reports-count", handleGetShortageReportsCount);
  app.post("/api/create-shortage-report", handleCreateShortageReport);
  app.post("/api/resolve-shortage-report", handleResolveShortageReport);
  app.post("/api/unresolve-shortage-report", handleUnresolveShortageReport);
  app.post("/api/delete-shortage-report", handleDeleteShortageReport);
  app.post("/api/habitual-products", handleGetHabitualProducts);
  app.post("/api/create-habitual-product", handleCreateHabitualProduct);
  app.post("/api/update-habitual-product", handleUpdateHabitualProduct);
  app.post("/api/delete-habitual-product", handleDeleteHabitualProduct);

  // Transfer automation engine
  app.post("/api/fire-transfer-automation", handleFireTransferAutomation);

  // Reservation status history (reactivation log)
  app.post("/api/get-reservation-status-history", handleGetReservationStatusHistory);
  app.post("/api/log-reservation-status-change", handleLogReservationStatusChange);
  app.post("/api/get-reactivated-reservation-ids", handleGetReactivatedReservationIds);
  app.post("/api/get-reactivated-reservations", handleGetReactivatedReservations);

  // Manual movement edit history
  app.post("/api/log-manual-movement-edit", handleLogManualMovementEdit);
  app.post("/api/get-manual-movement-history", handleGetManualMovementHistory);

  // ─── GPS Tracking (Xexun X24) ─────────────────────────────────────────────
  app.post("/api/xexun/push", handleXexunPush);
  app.post("/api/xexun/push/gps", handleXexunPushGps);
  app.post("/api/xexun/push/obd", handleXexunPushObd);
  app.post("/api/xexun/push/alarm", handleXexunPushAlarm);
  app.post("/api/gps/test-connection", handleGpsTestConnection);
  app.post("/api/gps/devices", handleGpsDevices);
  app.post("/api/gps/positions", handleGpsPositions);
  app.post("/api/gps/device-position", handleGpsDevicePosition);
  app.post("/api/gps/link-device", handleGpsLinkDevice);
  app.post("/api/gps/unlink-device", handleGpsUnlinkDevice);
  app.post("/api/gps/settings", handleGpsSettings);
  app.post("/api/gps/vehicle-by-plate", handleGpsVehicleByPlate);
  app.post("/api/gps/route-history", handleGpsRouteHistory);
  app.post("/api/gps/fleet-status", handleGpsFleetStatus);
  app.post("/api/gps/fleet-daily-km", handleGpsFleetDailyKm);
  // Keep old /api/traccar/* routes as aliases for backward compatibility
  app.post("/api/traccar/test-connection", handleGpsTestConnection);
  app.post("/api/traccar/devices", handleGpsDevices);
  app.post("/api/traccar/positions", handleGpsPositions);
  app.post("/api/traccar/device-position", handleGpsDevicePosition);
  app.post("/api/traccar/link-device", handleGpsLinkDevice);
  app.post("/api/traccar/unlink-device", handleGpsUnlinkDevice);
  app.post("/api/traccar/settings", handleGpsSettings);
  app.post("/api/traccar/vehicle-by-plate", handleGpsVehicleByPlate);
  app.post("/api/traccar/route-history", handleGpsRouteHistory);
  app.post("/api/traccar/fleet-status", handleGpsFleetStatus);
  app.post("/api/traccar/fleet-daily-km", handleGpsFleetDailyKm);


  // ─── Geofences ───────────────────────────────────────────────────────────
  app.post("/api/geofences/list", handleListGeofences);
  app.post("/api/geofences/create", handleCreateGeofence);
  app.post("/api/geofences/update", handleUpdateGeofence);
  app.post("/api/geofences/delete", handleDeleteGeofence);

  // ─── Parking Management ──────────────────────────────────────────────────
  app.post("/api/parking/zones", handleGetParkingZones);
  app.post("/api/parking/zones/create", handleCreateParkingZone);
  app.post("/api/parking/zones/delete/:id", handleDeleteParkingZone);
  app.post("/api/parking/spots", handleGetParkingSpots);
  app.post("/api/parking/spots/bulk", handleCreateParkingSpotsBulk);
  app.post("/api/parking/assign", handleAssignParkingSpot);
  app.post("/api/parking/release", handleReleaseParkingSpot);
  app.post("/api/parking/history", handleGetParkingHistory);
  app.post("/api/parking/overview", handleGetParkingOverview);
  app.post("/api/parking/seed-layout", handleSeedParkingLayout);

  // ─── Notification Trigger ─────────────────────────────────────────────────
  app.use("/api/notifications", notificationTriggerRouter);

  // ─── Scheduled (Heartbeat cron) endpoints ─────────────────────────────────
  app.post("/api/scheduled/lost-found-expiry", handleScheduledLostFoundExpiry);
  app.post("/api/scheduled/rently-poll", handleScheduledRentlyPoll);
  app.post("/api/scheduled/rently-enrich", handleScheduledRentlyEnrich);
  app.post("/api/scheduled/geofence-check", handleScheduledGeofenceCheck);

  // Open Graph meta tags for /track/:token (must be before SPA catch-all)
  const { trackingOgMiddleware } = await import("../trackingOgMiddleware");
  app.use(trackingOgMiddleware);

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
