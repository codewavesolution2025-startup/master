import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/auth.context';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/auth/Login';
import DashboardPage from './pages/Dashboard';
import ArticlesPage from './pages/referentiels/Articles';
import FournisseursPage from './pages/referentiels/Fournisseurs';
import { SitesPage, ClientsPage, PostesChargePage } from './pages/referentiels/SitesClientsPostes';
import { StockActuelPage, AlertesStockPage } from './pages/stock/StockActuel';
import LotsPage from './pages/stock/Lots';
import { MouvementsPage, InventairesPage } from './pages/stock/MouvementsInventaires';
import DemandesAchatPage from './pages/achats/DemandesAchat';
import CommandesAchatPage from './pages/achats/CommandesAchat';
import { ReceptionsPage, MrpPage } from './pages/achats/ReceptionsMrp';
import OrdresFabricationPage from './pages/production/OrdresFabrication';
import { NomenclaturesPage, GammesPage } from './pages/production/NomenclaturesGammes';
import { PlansControlePage, ControlesReceptionPage } from './pages/qualite/PlansControles';
import NonConformitesPage from './pages/qualite/NonConformites';
import { CommandesClientsPage, BonsLivraisonPage } from './pages/expeditions/Expeditions';
import { DashboardDirecteurPage, TrsPage, EcartsReportingPage } from './pages/reporting/Reporting';
import RhPage from './pages/rh/RhPage';
import DeploiementsPage from './pages/admin/DeploiementsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="referentiels/articles" element={<ArticlesPage />} />
        <Route path="referentiels/fournisseurs" element={<FournisseursPage />} />
        <Route path="referentiels/clients" element={<ClientsPage />} />
        <Route path="referentiels/sites" element={<SitesPage />} />
        <Route path="referentiels/postes-charge" element={<PostesChargePage />} />
        <Route path="stock/actuel" element={<StockActuelPage />} />
        <Route path="stock/alertes" element={<AlertesStockPage />} />
        <Route path="stock/lots" element={<LotsPage />} />
        <Route path="stock/mouvements" element={<MouvementsPage />} />
        <Route path="stock/inventaires" element={<InventairesPage />} />
        <Route path="achats/demandes" element={<DemandesAchatPage />} />
        <Route path="achats/commandes" element={<CommandesAchatPage />} />
        <Route path="achats/receptions" element={<ReceptionsPage />} />
        <Route path="achats/mrp" element={<MrpPage />} />
        <Route path="production/ordres" element={<OrdresFabricationPage />} />
        <Route path="production/nomenclatures" element={<NomenclaturesPage />} />
        <Route path="production/gammes" element={<GammesPage />} />
        <Route path="qualite/plans" element={<PlansControlePage />} />
        <Route path="qualite/controles" element={<ControlesReceptionPage />} />
        <Route path="qualite/nc" element={<NonConformitesPage />} />
        <Route path="expeditions/commandes" element={<CommandesClientsPage />} />
        <Route path="expeditions/bl" element={<BonsLivraisonPage />} />
        <Route path="reporting/dashboard" element={<DashboardDirecteurPage />} />
        <Route path="reporting/trs" element={<TrsPage />} />
        <Route path="reporting/ecarts" element={<EcartsReportingPage />} />
        <Route path="reporting/fournisseurs" element={<EcartsReportingPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        <Route path="/rh" element={<RhPage />} />
        <Route path="/admin/deploiements" element={<DeploiementsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
