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
} from "../authEndpoints";
import {
  handleApproveBrokerRegistration,
  handleRejectBrokerRegistration,
} from "../brokerRegistrationEndpoints";
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

  // ─── Broker registration endpoints ────────────────────────────────────────
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
