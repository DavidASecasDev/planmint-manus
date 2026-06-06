import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { NetworkErrorToast } from "@/components/NetworkErrorToast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { RentlySyncProvider } from "@/contexts/RentlySyncContext";
import { BrokerAuthProvider } from "@/contexts/BrokerAuthContext";
import { BrokerThemeProvider } from "@/contexts/BrokerThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import { ModuleRoute } from "@/components/modules/ModuleRoute";
import { BrokerProtectedRoute } from "@/components/broker/BrokerProtectedRoute";
import { ErrorBoundary, RouteErrorBoundary } from "@/components/ErrorBoundary";
import { useVisibilityRecovery } from "@/hooks/useVisibilityRecovery";

// PWA Components
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

// ---------------------------------------------------------------------------
// Lazy-loaded page components (code splitting)
// ---------------------------------------------------------------------------

// Super Admin Pages
const SuperAdminDashboard = lazy(() => import("./pages/super-admin/Dashboard"));
const SuperAdminOrganizations = lazy(() => import("./pages/super-admin/Organizations"));
const SuperAdminOrganizationDetail = lazy(() => import("./pages/super-admin/OrganizationDetail"));
const SuperAdminFeedback = lazy(() => import("./pages/super-admin/Feedback"));
const SuperAdminSubscriptions = lazy(() => import("./pages/super-admin/Subscriptions"));
const SuperAdminUsers = lazy(() => import("./pages/super-admin/Users"));
const SuperAdminAlerts = lazy(() => import("./pages/super-admin/Alerts"));
const SuperAdminAuditLogs = lazy(() => import("./pages/super-admin/AuditLogs"));
const SuperAdminCoupons = lazy(() => import("./pages/super-admin/Coupons"));
const SuperAdminOperations = lazy(() => import("./pages/super-admin/Operations"));
const SuperAdminFeatureFlags = lazy(() => import("./pages/super-admin/FeatureFlags"));
const SuperAdminDocumentation = lazy(() => import("./pages/super-admin/Documentation"));
const SuperAdminUserDetail = lazy(() => import("./pages/super-admin/UserDetail"));
const Help = lazy(() => import("./pages/Help"));

// Auth Pages
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const Recover = lazy(() => import("./pages/auth/Recover"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const Invitation = lazy(() => import("./pages/auth/Invitation"));

// Onboarding
const CreateOrganization = lazy(() => import("./pages/onboarding/CreateOrganization"));

// Core App Pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Teams = lazy(() => import("./pages/Teams"));
const TeamDetail = lazy(() => import("./pages/TeamDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const Areas = lazy(() => import("./pages/Areas"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Tags = lazy(() => import("./pages/Tags"));
const Reminders = lazy(() => import("./pages/Reminders"));
const Kanban = lazy(() => import("./pages/Kanban"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Install = lazy(() => import("./pages/Install"));
const Automations = lazy(() => import("./pages/Automations"));
const Admin = lazy(() => import("./pages/Admin"));
const DailyTasks = lazy(() => import("./pages/DailyTasks"));
const TimeTracking = lazy(() => import("./pages/TimeTracking"));
const VehicleStatus = lazy(() => import("./pages/VehicleStatus"));
const Preparation = lazy(() => import("./pages/Preparation"));

// Templates
const Templates = lazy(() => import("./pages/Templates"));
const TemplateDetail = lazy(() => import("./pages/TemplateDetail"));
const CreateTemplate = lazy(() => import("./pages/CreateTemplate"));
const CommunityTemplateDetail = lazy(() => import("./pages/CommunityTemplateDetail"));
const MyTemplateDetail = lazy(() => import("./pages/MyTemplateDetail"));
const ImportTemplate = lazy(() => import("./pages/ImportTemplate"));
const SharedTemplate = lazy(() => import("./pages/SharedTemplate"));

// Reports
const Reports = lazy(() => import("./pages/Reports"));
const ReportsPersonal = lazy(() => import("./pages/ReportsPersonal"));
const ReportsExports = lazy(() => import("./pages/ReportsExports"));
const ReportsAreas = lazy(() => import("./pages/ReportsAreas"));
const ReportsTeam = lazy(() => import("./pages/ReportsTeam"));
const ReportsVehicles = lazy(() => import("./pages/ReportsVehicles"));
const ReportsMovements = lazy(() => import("./pages/ReportsMovements"));
const ReportsTransfers = lazy(() => import("./pages/ReportsTransfers"));
const ReportsGaratech = lazy(() => import("./pages/ReportsGaratech"));
const ReportsTravel = lazy(() => import("./pages/ReportsTravel"));

// Forms
const Forms = lazy(() => import("./pages/Forms"));
const FormEditorPage = lazy(() => import("./pages/FormEditor"));
const PublicForm = lazy(() => import("./pages/PublicForm"));
const PublicTransferForm = lazy(() => import("./pages/PublicTransferForm"));
const PublicOperations = lazy(() => import("./pages/PublicOperations"));
const PublicPreparation = lazy(() => import("./pages/PublicPreparation"));
const PublicTracking = lazy(() => import("./pages/PublicTracking"));

// Programación (operations / scheduling)
const Reservations = lazy(() => import("./pages/Reservations"));
const ReservationDetail = lazy(() => import("./pages/ReservationDetail"));
const LiveMap = lazy(() => import("./pages/LiveMap"));

// Garatech Module
const GaratechDashboard = lazy(() => import("./pages/garatech/Dashboard"));
const GaratechRepairs = lazy(() => import("./pages/garatech/Repairs"));
const GaratechRepairDetail = lazy(() => import("./pages/garatech/RepairDetail"));
const GaratechRepairNew = lazy(() => import("./pages/garatech/RepairNew"));
const GaratechAccidents = lazy(() => import("./pages/garatech/Accidents"));
const GaratechAccidentDetail = lazy(() => import("./pages/garatech/AccidentDetail"));
const GaratechWorkshops = lazy(() => import("./pages/garatech/Workshops"));
const GaratechWorkshopDetail = lazy(() => import("./pages/garatech/WorkshopDetail"));
const GaratechWorkshopNew = lazy(() => import("./pages/garatech/WorkshopNew"));
const GaratechDamageCatalog = lazy(() => import("./pages/garatech/DamageCatalog"));
const GaratechDamageReports = lazy(() => import("./pages/garatech/DamageReports"));
const GaratechDamagesHub = lazy(() => import("./pages/garatech/DamagesHub"));
const GaratechDamageReportDetail = lazy(() => import("./pages/garatech/DamageReportDetailPage"));
const GaratechDamageReportNew = lazy(() => import("./pages/garatech/DamageReportNew"));

// Movements Module
const Movements = lazy(() => import("./pages/Movements"));
const StartMovement = lazy(() => import("./pages/movements/StartMovement"));
const MovementDetail = lazy(() => import("./pages/movements/MovementDetail"));

// Fleet Module
const FleetList = lazy(() => import("./pages/fleet/FleetList"));
const FleetNew = lazy(() => import("./pages/fleet/FleetNew"));
const FleetEdit = lazy(() => import("./pages/fleet/FleetEdit"));
const FleetDetail = lazy(() => import("./pages/fleet/FleetDetail"));
const FleetInspectionNew = lazy(() => import("./pages/fleet/FleetInspectionNew"));
const FleetInspectionDetail = lazy(() => import("./pages/fleet/FleetInspectionDetail"));
const FleetInspectionEdit = lazy(() => import("./pages/fleet/FleetInspectionEdit"));
const FleetDamages = lazy(() => import("./pages/fleet/FleetDamages"));
const FleetAudits = lazy(() => import("./pages/fleet/FleetAudits"));
const FleetEquipment = lazy(() => import("./pages/fleet/FleetEquipment"));

// Transfers Module
const Transfers = lazy(() => import("./pages/transfers/Transfers"));
const TransferDetail = lazy(() => import("./pages/transfers/TransferDetail"));
const BrokerManagement = lazy(() => import("./pages/transfers/BrokerManagement"));
const TransferPricing = lazy(() => import("./pages/transfers/TransferPricing"));
const InternalNewTransferWizard = lazy(() => import("./pages/transfers/InternalNewTransferWizard"));
const InternalEditTransferWizard = lazy(() => import("./pages/transfers/InternalEditTransferWizard"));

// Lost & Found
const LostFoundList = lazy(() => import("./pages/LostFoundList"));
const LostFoundDetail = lazy(() => import("./pages/LostFoundDetail"));
const LostFoundForm = lazy(() => import("./pages/LostFoundForm"));

// Timeline
const TimelinePage = lazy(() => import("./pages/TimelinePage"));

// Service Requests (cross-org)
const ServiceRequests = lazy(() => import("./pages/ServiceRequests"));
const ServiceRequestDetail = lazy(() => import("./pages/ServiceRequestDetail"));
const Schedules = lazy(() => import("./pages/Schedules"));

// Admin Pages
const PermissionsDiagnostics = lazy(() => import("./pages/admin/PermissionsDiagnostics"));
const TasksTrash = lazy(() => import("./pages/admin/TasksTrash"));

// Broker Portal Pages
const BrokerLogin = lazy(() => import("./pages/broker/BrokerLogin"));
const BrokerRegister = lazy(() => import("./pages/broker/BrokerRegister"));
const BrokerDashboard = lazy(() => import("./pages/broker/BrokerDashboard"));
const BrokerNewRequest = lazy(() => import("./pages/broker/BrokerNewRequest"));
const BrokerRequestDetail = lazy(() => import("./pages/broker/BrokerRequestDetail"));
const BrokerEditRequest = lazy(() => import("./pages/broker/BrokerEditRequest"));

// Public Pages (removed - app is now internal-only)

// Non-lazy pages (always needed)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry auth errors — redirect is already in progress
        if (error instanceof Error && (error.name === 'AuthExpiredError' || error.message.includes('401'))) return false;
        return failureCount < 2; // Up to 2 retries (3 total attempts)
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
      staleTime: 60_000, // 60s stale time — reduces re-fetches on navigation
      gcTime: 5 * 60_000, // Keep unused data in cache for 5 minutes
      refetchOnWindowFocus: false, // Avoid unnecessary refetches on every tab switch
      refetchOnReconnect: true, // CRITICAL: Refetch stale queries when connection is restored
    },
    mutations: {
      retry: 1,
    },
  },
});

// Componente wrapper para rutas principales (con AuthProvider)
function MainAppRoutes() {
  return (
    <QueryRecovery />
  );
}

/**
 * Inner component that has access to QueryClientProvider context.
 * Activates visibility recovery and renders the full app tree.
 */
function QueryRecovery() {
  // Invalidate stale queries when user returns after 5+ min of inactivity
  useVisibilityRecovery(5 * 60 * 1000);

  return (
    <AuthProvider>
      <ThemeProvider>
        <RentlySyncProvider>
        <OfflineProvider>
          <InstallPrompt />
          <RouteErrorBoundary>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Root: redirect to login or dashboard */}
            <Route path="/" element={<Index />} />
            {/* Public form routes */}
            <Route path="/f/:slug" element={<PublicForm />} />
            <Route path="/transfer/:slug" element={<PublicTransferForm />} />
            <Route path="/ops/preparacion" element={<PublicPreparation />} />
            <Route path="/ops/:slug" element={<PublicOperations />} />
            <Route path="/track/:token" element={<PublicTracking />} />
            <Route path="/install" element={<Install />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/recover" element={<Recover />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/invitation/:token" element={<Invitation />} />
            
            {/* Onboarding (authenticated but no org) */}
            <Route 
              path="/onboarding/create-organization" 
              element={
                <ProtectedRoute requireOrganization={false}>
                  <CreateOrganization />
                </ProtectedRoute>
              } 
            />
            
            {/* Protected routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/areas" 
              element={
                <ProtectedRoute>
                  <Areas />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tasks" 
              element={
                <ProtectedRoute>
                  <Tasks />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/reservations" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="reservations" 
                    moduleName="Programación"
                    moduleDescription="El módulo de Programación no está habilitado para tu organización. Contacta con soporte si necesitas esta funcionalidad."
                  >
                    <Reservations />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reservations/:id" 
              element={
                <ProtectedRoute>
                  <ReservationDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/live-map" 
              element={
                <ProtectedRoute>
                  <LiveMap />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/preparation" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="preparation" 
                    moduleName="Preparación"
                    moduleDescription="El módulo de Preparación no está habilitado para tu organización."
                  >
                    <Preparation />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/vehicles" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="vehicle_status" 
                    moduleName="Estado de Coches"
                    moduleDescription="El módulo de Estado de Coches no está habilitado para tu organización."
                  >
                    <VehicleStatus />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tags" 
              element={
                <ProtectedRoute>
                  <Tags />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reminders" 
              element={
                <ProtectedRoute>
                  <Reminders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/kanban" 
              element={
                <ProtectedRoute>
                  <Kanban />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tasks/kanban" 
              element={
                <ProtectedRoute>
                  <Kanban />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/calendar" 
              element={
                <ProtectedRoute>
                  <Calendar />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tasks/calendar" 
              element={
                <ProtectedRoute>
                  <Calendar />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/teams" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="teams" 
                    moduleName="Equipos"
                    moduleDescription="El módulo de Equipos no está habilitado para tu organización."
                  >
                    <Teams />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/teams/:id" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="teams" moduleName="Equipos">
                    <TeamDetail />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/admin" 
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/permissions" 
              element={
                <ProtectedRoute>
                  <PermissionsDiagnostics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/admin/permissions" 
              element={
                <ProtectedRoute>
                  <PermissionsDiagnostics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/admin/diagnostics" 
              element={
                <ProtectedRoute>
                  <PermissionsDiagnostics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/trash" 
              element={
                <ProtectedRoute>
                  <TasksTrash />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/admin/trash" 
              element={
                <ProtectedRoute>
                  <TasksTrash />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/automations" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="automations" 
                    moduleName="Automatizaciones"
                    moduleDescription="El módulo de Automatizaciones no está habilitado para tu organización."
                  >
                    <Automations />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            {/* Time Tracking */}
            <Route 
              path="/time-tracking" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="time_tracking" 
                    moduleName="Control de Tiempo"
                    moduleDescription="El módulo de Control de Tiempo no está habilitado para tu organización."
                  >
                    <TimeTracking />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            {/* Daily Tasks */}
            <Route 
              path="/daily-tasks" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="daily_tasks" 
                    moduleName="Tareas Diarias"
                    moduleDescription="El módulo de Tareas Diarias no está habilitado para tu organización."
                  >
                    <DailyTasks />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tasks/daily" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="daily_tasks" 
                    moduleName="Tareas Diarias"
                    moduleDescription="El módulo de Tareas Diarias no está habilitado para tu organización."
                  >
                    <DailyTasks />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            {/* Forms */}
            <Route 
              path="/forms" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="forms" 
                    moduleName="Formularios"
                    moduleDescription="El módulo de Formularios no está habilitado para tu organización."
                  >
                    <Forms />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/transfers/forms" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="forms" 
                    moduleName="Formularios"
                    moduleDescription="El módulo de Formularios no está habilitado para tu organización."
                  >
                    <Forms />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/transfers/forms/new" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="forms" 
                    moduleName="Formularios"
                    moduleDescription="El módulo de Formularios no está habilitado para tu organización."
                  >
                    <Forms />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/forms/:id/edit" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="forms" moduleName="Formularios">
                    <FormEditorPage />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            {/* Reports */}
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="reports" 
                    moduleName="Informes"
                    moduleDescription="El módulo de Informes no está habilitado para tu organización."
                  >
                    <Reports />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/travel" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="reports" moduleName="Informes">
                    <ReportsTravel />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/personal" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="reports" moduleName="Informes">
                    <ReportsPersonal />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/team" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="reports" moduleName="Informes">
                    <ReportsTeam />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/areas" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="reports" moduleName="Informes">
                    <ReportsAreas />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/vehicles" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="reports" moduleName="Informes">
                    <ReportsVehicles />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/movements" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="reports" moduleName="Informes">
                    <ReportsMovements />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/transfers" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="reports" moduleName="Informes">
                    <ReportsTransfers />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/garatech" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="reports" moduleName="Informes">
                    <ReportsGaratech />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/exports" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="reports" moduleName="Informes">
                    <ReportsExports />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            {/* Templates */}
            <Route 
              path="/templates" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="templates" 
                    moduleName="Plantillas"
                    moduleDescription="El módulo de Plantillas no está habilitado para tu organización."
                  >
                    <Templates />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/templates/create" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="templates" moduleName="Plantillas">
                    <CreateTemplate />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/templates/community/:id" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="templates" moduleName="Plantillas">
                    <CommunityTemplateDetail />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/templates/mine/:id" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="templates" moduleName="Plantillas">
                    <MyTemplateDetail />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/templates/import/:id" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="templates" moduleName="Plantillas">
                    <ImportTemplate />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/templates/shared/:shareCode" 
              element={<SharedTemplate />} 
            />
            {/* Garatech Module Routes */}
            <Route 
              path="/garatech" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="garatech" 
                    moduleName="Garatech"
                    moduleDescription="El módulo Garatech no está habilitado para tu organización."
                  >
                    <GaratechDashboard />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/garatech/repairs" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                    <GaratechRepairs />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/garatech/repairs/new" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                    <GaratechRepairNew />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/garatech/repairs/:id" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                    <GaratechRepairDetail />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/garatech/accidents" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                    <GaratechAccidents />
                  </ModuleRoute>
                </ProtectedRoute>
              }
            />
            <Route 
              path="/garatech/accidents/:id" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                    <GaratechAccidentDetail />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/garatech/workshops" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                    <GaratechWorkshops />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/garatech/workshops/new" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                    <GaratechWorkshopNew />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/garatech/workshops/:id" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                    <GaratechWorkshopDetail />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/garatech/catalog" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                    <GaratechDamageCatalog />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/garatech/reports/new" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                    <GaratechDamageReportNew />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/garatech/reports/:id" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                    <GaratechDamageReportDetail />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/garatech/reports" 
              element={<Navigate to="/garatech/damages?tab=informes" replace />}
            />
            <Route 
              path="/garatech/damages" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                    <GaratechDamagesHub />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            {/* Movements Module Routes */}
            <Route path="/movements" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="movements" moduleName="Movimientos" moduleDescription="El módulo de Movimientos no está habilitado para tu organización.">
                  <Movements />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            <Route path="/movements/new" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="movements" moduleName="Movimientos">
                  <StartMovement />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            <Route path="/movements/:id" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="movements" moduleName="Movimientos">
                  <MovementDetail />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            {/* Fleet Module Routes */}
            <Route path="/fleet" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="fleet" moduleName="Flota" moduleDescription="El módulo de Flota no está habilitado para tu organización.">
                  <FleetList />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            <Route path="/fleet/new" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="fleet" moduleName="Flota">
                  <FleetNew />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            <Route path="/fleet/damages" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="garatech" moduleName="Garatech">
                  <GaratechDamagesHub />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            <Route path="/fleet/audits" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="fleet" moduleName="Flota">
                  <FleetAudits />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            <Route path="/fleet/equipment" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="fleet" moduleName="Flota">
                  <FleetEquipment />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            <Route path="/fleet/:id" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="fleet" moduleName="Flota">
                  <FleetDetail />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            <Route path="/fleet/:id/edit" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="fleet" moduleName="Flota">
                  <FleetEdit />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            <Route path="/fleet/:id/inspection/new" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="fleet" moduleName="Flota">
                  <FleetInspectionNew />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            <Route path="/fleet/:id/inspection/:inspId" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="fleet" moduleName="Flota">
                  <FleetInspectionDetail />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            <Route path="/fleet/:id/inspection/:inspId/edit" element={
              <ProtectedRoute>
                <ModuleRoute moduleKey="fleet" moduleName="Flota">
                  <FleetInspectionEdit />
                </ModuleRoute>
              </ProtectedRoute>
            } />
            {/* Transfers Module Routes */}
            <Route 
              path="/transfers" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="transfers" 
                    moduleName="Transfers"
                    moduleDescription="El módulo de Transfers no está habilitado para tu organización."
                  >
                    <Transfers />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/transfers/brokers" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="transfers" moduleName="Transfers">
                    <BrokerManagement />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/transfers/tarifas" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="transfers" moduleName="Transfers">
                    <TransferPricing />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/transfers/new" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="transfers" moduleName="Transfers">
                    <InternalNewTransferWizard />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/transfers/:id/edit" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="transfers" moduleName="Transfers">
                    <InternalEditTransferWizard />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/transfers/requests/:id" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="transfers" moduleName="Transfers">
                    <TransferDetail />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/transfers/:id" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="transfers" 
                    moduleName="Transfers"
                    moduleDescription="El módulo de Transfers no está habilitado para tu organización."
                  >
                    <TransferDetail />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />

            {/* Timeline */}
            <Route 
              path="/timeline" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="reservations" 
                    moduleName="Timeline"
                    moduleDescription="El módulo de Timeline requiere el módulo de Reservas habilitado."
                  >
                    <TimelinePage />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />

            {/* Lost & Found */}
            <Route 
              path="/lost-found" 
              element={
                <ProtectedRoute>
                  <ModuleRoute 
                    moduleKey="lost_found" 
                    moduleName="Objetos Perdidos"
                    moduleDescription="El módulo de Objetos Perdidos no está habilitado para tu organización."
                  >
                    <LostFoundList />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/lost-found/new" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="lost_found" moduleName="Objetos Perdidos">
                    <LostFoundForm />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/lost-found/:id/edit" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="lost_found" moduleName="Objetos Perdidos">
                    <LostFoundForm />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/lost-found/:id" 
              element={
                <ProtectedRoute>
                  <ModuleRoute moduleKey="lost_found" moduleName="Objetos Perdidos">
                    <LostFoundDetail />
                  </ModuleRoute>
                </ProtectedRoute>
              } 
            />

            {/* Service Requests (cross-org) */}
            <Route 
              path="/service-requests" 
              element={
                <ProtectedRoute>
                  <ServiceRequests />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/service-requests/:id" 
              element={
                <ProtectedRoute>
                  <ServiceRequestDetail />
                </ProtectedRoute>
              } 
            />

            {/* Schedules (Horarios) */}
            <Route 
              path="/schedules" 
              element={
                <ProtectedRoute>
                  <Schedules />
                </ProtectedRoute>
              } 
            />

            {/* Super Admin Routes */}
            <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
            <Route path="/super-admin/alerts" element={<SuperAdminRoute><SuperAdminAlerts /></SuperAdminRoute>} />
            <Route path="/super-admin/organizations" element={<SuperAdminRoute><SuperAdminOrganizations /></SuperAdminRoute>} />
            <Route path="/super-admin/organizations/:id" element={<SuperAdminRoute><SuperAdminOrganizationDetail /></SuperAdminRoute>} />
            <Route path="/super-admin/users" element={<SuperAdminRoute><SuperAdminUsers /></SuperAdminRoute>} />
            <Route path="/super-admin/users/:id" element={<SuperAdminRoute><SuperAdminUserDetail /></SuperAdminRoute>} />
            <Route path="/super-admin/feedback" element={<SuperAdminRoute><SuperAdminFeedback /></SuperAdminRoute>} />
            <Route path="/super-admin/subscriptions" element={<SuperAdminRoute><SuperAdminSubscriptions /></SuperAdminRoute>} />
            <Route path="/super-admin/coupons" element={<SuperAdminRoute><SuperAdminCoupons /></SuperAdminRoute>} />
            <Route path="/super-admin/operations" element={<SuperAdminRoute><SuperAdminOperations /></SuperAdminRoute>} />
            <Route path="/super-admin/audit-logs" element={<SuperAdminRoute><SuperAdminAuditLogs /></SuperAdminRoute>} />
            <Route path="/super-admin/feature-flags" element={<SuperAdminRoute><SuperAdminFeatureFlags /></SuperAdminRoute>} />
            <Route path="/super-admin/docs" element={<SuperAdminRoute><SuperAdminDocumentation /></SuperAdminRoute>} />

            {/* Help - accessible to all authenticated users */}
            <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
            <Route 
              path="/templates/:slug" 
              element={
                <ProtectedRoute>
                  <TemplateDetail />
                </ProtectedRoute>
              } 
            />
            
            {/* Catch-all for main app - redirect to 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </RouteErrorBoundary>
        </OfflineProvider>
        </RentlySyncProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

// Componente wrapper para rutas de Broker (con BrokerAuthProvider, SIN AuthProvider)
function BrokerPortalRoutes() {
  return (
    <BrokerThemeProvider>
    <BrokerAuthProvider>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="register" element={<BrokerRegister />} />
        <Route path="login" element={<BrokerLogin />} />
        <Route index element={
          <BrokerProtectedRoute>
            <BrokerDashboard />
          </BrokerProtectedRoute>
        } />
        <Route path="new" element={
          <BrokerProtectedRoute>
            <BrokerNewRequest />
          </BrokerProtectedRoute>
        } />
        <Route path="request/:id" element={
          <BrokerProtectedRoute>
            <BrokerRequestDetail />
          </BrokerProtectedRoute>
        } />
        <Route path="request/:id/edit" element={
          <BrokerProtectedRoute>
            <BrokerEditRequest />
          </BrokerProtectedRoute>
        } />
        {/* Fallback for unknown /broker/* routes */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </BrokerAuthProvider>
    </BrokerThemeProvider>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <NetworkErrorToast />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Broker Portal Routes - FUERA de AuthProvider */}
            <Route path="/broker/*" element={<BrokerPortalRoutes />} />
            
            {/* Todas las demás rutas - CON AuthProvider */}
            <Route path="/*" element={<MainAppRoutes />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
