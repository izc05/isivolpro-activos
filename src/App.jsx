import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import ProtectedRoute from './components/Security/ProtectedRoute';
import Login from './pages/Login';
import InvitationRegister from './pages/InvitationRegister';
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
import WorkOrderDashboard from './pages/WorkOrderDashboard';
import WorkOrders from './pages/WorkOrders';
import MyWorkOrders from './pages/MyWorkOrders';
import WorkOrderDetail from './pages/WorkOrderDetail';
import WorkOrderVisit from './pages/WorkOrderVisit';
import WorkOrderChecklist from './pages/WorkOrderChecklist';
import WorkOrderSignature from './pages/WorkOrderSignature';
import WorkOrderReport from './pages/WorkOrderReport';
import Incidents from './pages/Incidents';
import QRGenerator from './pages/QRGenerator';
import AuditLogs from './pages/AuditLogs';
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
      <Route path="/aviso/:token" element={<PublicIncidentReport />} />
      <Route path="/qr/:token" element={<ProtectedRoute><QRResolver /></ProtectedRoute>} />
      <Route path="/denegado" element={<AccessDenied />} />
      <Route path="/qr-no-valido" element={<InvalidQr />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="scanner" element={<QRScanner />} />
        <Route path="clientes" element={<Clients />} />
        <Route path="instalaciones" element={<Installations />} />
        <Route path="instalaciones/:id" element={<InstallationDetail />} />
        <Route path="ubicaciones" element={<Locations />} />
        <Route path="ubicaciones/:id" element={<LocationDetail />} />
        <Route path="activos" element={<Assets />} />
        <Route path="activos/:id" element={<AssetDetail />} />
        <Route path="documentos" element={<Documents />} />
        <Route path="videos" element={<Videos />} />
        <Route path="fotos" element={<Photos />} />
        <Route path="mantenimiento" element={<MaintenanceHistory />} />
        <Route path="ots-dashboard" element={<WorkOrderDashboard />} />
        <Route path="ots" element={<WorkOrders />} />
        <Route path="mis-ots" element={<MyWorkOrders />} />
        <Route path="ots-creadas" element={<MyWorkOrders mode="created" />} />
        <Route path="ots/:id" element={<WorkOrderDetail />} />
        <Route path="ots/:id/visita" element={<WorkOrderVisit />} />
        <Route path="ots/:id/checklist" element={<WorkOrderChecklist />} />
        <Route path="ots/:id/firma" element={<WorkOrderSignature />} />
        <Route path="ots/:id/informe" element={<WorkOrderReport />} />
        <Route path="incidencias" element={<Incidents />} />
        <Route path="qr" element={<QRGenerator />} />
        <Route path="auditoria" element={<AuditLogs />} />
        <Route path="usuarios" element={<UsersPermissions />} />
        <Route path="ajustes" element={<Settings />} />
        <Route path="privacidad" element={<PrivacyNotice />} />
      </Route>
    </Routes>
  );
}
