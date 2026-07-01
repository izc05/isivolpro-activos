import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import ProtectedRoute from './components/Security/ProtectedRoute';
import { AdminRoute, CoordinatorRoute, HomeRedirect, IncidentRoute, InventoryRoute, MaintenanceRoute, OcaRoute, TechnicianExecutionRoute, TechnicianRoute, WorkOrderManagerRoute } from './components/Security/RoleRoute';
import Login from './pages/Login';
import InvitationRegister from './pages/InvitationRegister';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import QRScanner from './pages/QRScanner';
import QRResolver from './pages/QRResolver';
import Clients from './pages/Clients';
import Installations from './pages/Installations';
import InstallationDetail from './pages/InstallationDetail';
import Locations from './pages/Locations';
import LocationDetail from './pages/LocationDetail';
import Assets from './pages/Assets';
import AssetDetail from './pages/AssetDetail';
import Documents from './pages/Documents';
import Videos from './pages/Videos';
import Photos from './pages/Photos';
import MaintenanceHistory from './pages/MaintenanceHistory';
import MaintenanceDashboard from './pages/MaintenanceDashboard';
import MaintenancePlans from './pages/MaintenancePlans';
import MaintenancePlanDetail from './pages/MaintenancePlanDetail';
import MaintenanceCalendar from './pages/MaintenanceCalendar';
import PendingMaintenance from './pages/PendingMaintenance';
import CorrectiveMaintenance from './pages/CorrectiveMaintenance';
import OcaDashboard from './pages/OcaDashboard';
import OcaInspections from './pages/OcaInspections';
import OcaInspectionDetail from './pages/OcaInspectionDetail';
import OcaDueDates from './pages/OcaDueDates';
import OcaIncidents from './pages/OcaIncidents';
import OcaDocuments from './pages/OcaDocuments';
import WorkOrderDashboard from './pages/WorkOrderDashboard';
import WorkOrderControl from './pages/WorkOrderControl';
import WorkOrderAgenda from './pages/WorkOrderAgenda';
import WorkOrders from './pages/WorkOrders';
import CompletedWorkOrders from './pages/CompletedWorkOrders';
import MyWorkOrders from './pages/MyWorkOrders';
import WorkOrderDetail from './pages/WorkOrderDetail';
import WorkOrderVisit from './pages/WorkOrderVisit';
import WorkOrderChecklist from './pages/WorkOrderChecklist';
import WorkOrderSignature from './pages/WorkOrderSignature';
import WorkOrderReport from './pages/WorkOrderReport';
import Incidents from './pages/Incidents';
import QRGenerator from './pages/QRGenerator';
import AuditLogs from './pages/AuditLogs';
import UserModule from './pages/UserModule';
import UserDetail from './pages/UserDetail';
import UsersPermissions from './pages/UsersPermissions';
import Settings from './pages/Settings';
import AccessDenied from './pages/AccessDenied';
import InvalidQr from './pages/InvalidQr';
import PrivacyNotice from './pages/PrivacyNotice';
import PublicIncidentReport from './pages/PublicIncidentReport';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<InvitationRegister />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/aviso/:token" element={<PublicIncidentReport />} />
      <Route path="/qr/:token" element={<ProtectedRoute><QRResolver /></ProtectedRoute>} />
      <Route path="/denegado" element={<AccessDenied />} />
      <Route path="/qr-no-valido" element={<InvalidQr />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<HomeRedirect />} />
        <Route path="dashboard" element={<CoordinatorRoute><Dashboard /></CoordinatorRoute>} />
        <Route path="scanner" element={<QRScanner />} />
        <Route path="clientes" element={<AdminRoute><Clients /></AdminRoute>} />
        <Route path="instalaciones" element={<InventoryRoute><Installations /></InventoryRoute>} />
        <Route path="instalaciones/:id" element={<InventoryRoute><InstallationDetail /></InventoryRoute>} />
        <Route path="ubicaciones" element={<InventoryRoute><Locations /></InventoryRoute>} />
        <Route path="ubicaciones/:id" element={<InventoryRoute><LocationDetail /></InventoryRoute>} />
        <Route path="activos" element={<InventoryRoute><Assets /></InventoryRoute>} />
        <Route path="activos/:id" element={<InventoryRoute><AssetDetail /></InventoryRoute>} />
        <Route path="documentos" element={<InventoryRoute><Documents /></InventoryRoute>} />
        <Route path="videos" element={<InventoryRoute><Videos /></InventoryRoute>} />
        <Route path="fotos" element={<InventoryRoute><Photos /></InventoryRoute>} />
        <Route path="mantenimiento" element={<MaintenanceRoute><MaintenanceDashboard /></MaintenanceRoute>} />
        <Route path="mantenimiento/planes" element={<MaintenanceRoute><MaintenancePlans /></MaintenanceRoute>} />
        <Route path="mantenimiento/planes/:id" element={<MaintenanceRoute><MaintenancePlanDetail /></MaintenanceRoute>} />
        <Route path="mantenimiento/calendario" element={<MaintenanceRoute><MaintenanceCalendar /></MaintenanceRoute>} />
        <Route path="mantenimiento/pendientes" element={<MaintenanceRoute><PendingMaintenance /></MaintenanceRoute>} />
        <Route path="mantenimiento/correctivos" element={<MaintenanceRoute><CorrectiveMaintenance /></MaintenanceRoute>} />
        <Route path="mantenimiento/historial" element={<MaintenanceRoute><MaintenanceHistory /></MaintenanceRoute>} />
        <Route path="oca" element={<OcaRoute><OcaDashboard /></OcaRoute>} />
        <Route path="oca/inspecciones" element={<OcaRoute><OcaInspections /></OcaRoute>} />
        <Route path="oca/inspecciones/nueva" element={<OcaRoute><OcaInspectionDetail mode="new" /></OcaRoute>} />
        <Route path="oca/inspecciones/:id" element={<OcaRoute><OcaInspectionDetail /></OcaRoute>} />
        <Route path="oca/vencimientos" element={<OcaRoute><OcaDueDates /></OcaRoute>} />
        <Route path="oca/incidencias" element={<OcaRoute><OcaIncidents /></OcaRoute>} />
        <Route path="oca/documentacion" element={<OcaRoute><OcaDocuments /></OcaRoute>} />
        <Route path="ots-dashboard" element={<WorkOrderManagerRoute><WorkOrderDashboard /></WorkOrderManagerRoute>} />
        <Route path="ots-control" element={<WorkOrderManagerRoute><WorkOrderControl /></WorkOrderManagerRoute>} />
        <Route path="ots-agenda" element={<WorkOrderManagerRoute><WorkOrderAgenda /></WorkOrderManagerRoute>} />
        <Route path="ots" element={<WorkOrderManagerRoute><WorkOrders /></WorkOrderManagerRoute>} />
        <Route path="ots-realizadas" element={<WorkOrderManagerRoute><CompletedWorkOrders /></WorkOrderManagerRoute>} />
        <Route path="mis-ots" element={<TechnicianRoute><MyWorkOrders /></TechnicianRoute>} />
        <Route path="ots-creadas" element={<WorkOrderManagerRoute><MyWorkOrders mode="created" /></WorkOrderManagerRoute>} />
        <Route path="ots/:id" element={<TechnicianRoute><WorkOrderDetail /></TechnicianRoute>} />
        <Route path="ots/:id/visita" element={<TechnicianExecutionRoute><WorkOrderVisit /></TechnicianExecutionRoute>} />
        <Route path="ots/:id/checklist" element={<TechnicianRoute><WorkOrderChecklist /></TechnicianRoute>} />
        <Route path="ots/:id/firma" element={<TechnicianRoute><WorkOrderSignature /></TechnicianRoute>} />
        <Route path="ots/:id/informe" element={<TechnicianRoute><WorkOrderReport /></TechnicianRoute>} />
        <Route path="incidencias" element={<IncidentRoute><Incidents /></IncidentRoute>} />
        <Route path="qr" element={<AdminRoute><QRGenerator /></AdminRoute>} />
        <Route path="usuarios-panel" element={<AdminRoute><UserModule /></AdminRoute>} />
        <Route path="usuarios/:memberId" element={<AdminRoute><UserDetail /></AdminRoute>} />
        <Route path="auditoria" element={<AdminRoute><AuditLogs /></AdminRoute>} />
        <Route path="usuarios" element={<AdminRoute><UsersPermissions /></AdminRoute>} />
        <Route path="ajustes" element={<Settings />} />
        <Route path="privacidad" element={<PrivacyNotice />} />
      </Route>
      <Route path="*" element={<AuthCallback />} />
    </Routes>
  );
}


