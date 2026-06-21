import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import ProtectedRoute from './components/Security/ProtectedRoute';
import { AdminRoute, HomeRedirect, InventoryRoute, WorkOrderManagerRoute } from './components/Security/RoleRoute';
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
        <Route path="dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="scanner" element={<QRScanner />} />
        <Route path="clientes" element={<AdminRoute><Clients /></AdminRoute>} />
        <Route path="instalaciones" element={<InventoryRoute><Installations /></InventoryRoute>} />
        <Route path="instalaciones/:id" element={<InstallationDetail />} />
        <Route path="ubicaciones" element={<InventoryRoute><Locations /></InventoryRoute>} />
        <Route path="ubicaciones/:id" element={<LocationDetail />} />
        <Route path="activos" element={<InventoryRoute><Assets /></InventoryRoute>} />
        <Route path="activos/:id" element={<AssetDetail />} />
        <Route path="documentos" element={<InventoryRoute><Documents /></InventoryRoute>} />
        <Route path="videos" element={<InventoryRoute><Videos /></InventoryRoute>} />
        <Route path="fotos" element={<InventoryRoute><Photos /></InventoryRoute>} />
        <Route path="mantenimiento" element={<InventoryRoute><MaintenanceDashboard /></InventoryRoute>} />
        <Route path="mantenimiento/planes" element={<InventoryRoute><MaintenancePlans /></InventoryRoute>} />
        <Route path="mantenimiento/planes/:id" element={<InventoryRoute><MaintenancePlanDetail /></InventoryRoute>} />
        <Route path="mantenimiento/calendario" element={<InventoryRoute><MaintenanceCalendar /></InventoryRoute>} />
        <Route path="mantenimiento/pendientes" element={<InventoryRoute><PendingMaintenance /></InventoryRoute>} />
        <Route path="mantenimiento/correctivos" element={<InventoryRoute><CorrectiveMaintenance /></InventoryRoute>} />
        <Route path="mantenimiento/historial" element={<InventoryRoute><MaintenanceHistory /></InventoryRoute>} />
        <Route path="oca" element={<InventoryRoute><OcaDashboard /></InventoryRoute>} />
        <Route path="oca/inspecciones" element={<InventoryRoute><OcaInspections /></InventoryRoute>} />
        <Route path="oca/inspecciones/nueva" element={<InventoryRoute><OcaInspectionDetail mode="new" /></InventoryRoute>} />
        <Route path="oca/inspecciones/:id" element={<InventoryRoute><OcaInspectionDetail /></InventoryRoute>} />
        <Route path="oca/vencimientos" element={<InventoryRoute><OcaDueDates /></InventoryRoute>} />
        <Route path="oca/incidencias" element={<InventoryRoute><OcaIncidents /></InventoryRoute>} />
        <Route path="oca/documentacion" element={<InventoryRoute><OcaDocuments /></InventoryRoute>} />
        <Route path="ots-dashboard" element={<WorkOrderManagerRoute><WorkOrderDashboard /></WorkOrderManagerRoute>} />
        <Route path="ots-control" element={<WorkOrderManagerRoute><WorkOrderControl /></WorkOrderManagerRoute>} />
        <Route path="ots-agenda" element={<WorkOrderManagerRoute><WorkOrderAgenda /></WorkOrderManagerRoute>} />
        <Route path="ots" element={<WorkOrderManagerRoute><WorkOrders /></WorkOrderManagerRoute>} />
        <Route path="ots-realizadas" element={<WorkOrderManagerRoute><CompletedWorkOrders /></WorkOrderManagerRoute>} />
        <Route path="mis-ots" element={<MyWorkOrders />} />
        <Route path="ots-creadas" element={<WorkOrderManagerRoute><MyWorkOrders mode="created" /></WorkOrderManagerRoute>} />
        <Route path="ots/:id" element={<WorkOrderDetail />} />
        <Route path="ots/:id/visita" element={<WorkOrderVisit />} />
        <Route path="ots/:id/checklist" element={<WorkOrderChecklist />} />
        <Route path="ots/:id/firma" element={<WorkOrderSignature />} />
        <Route path="ots/:id/informe" element={<WorkOrderReport />} />
        <Route path="incidencias" element={<Incidents />} />
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
