import { useState } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth, canAccess, ROLE_LABELS } from '../store/auth.context';
import AiAgent from '../components/ai/AiAgent';
import './MainLayout.css';

const NAV_ITEMS = [
  { label: 'Tableau de bord', icon: '⬡', path: '/dashboard', module: 'dashboard', always: true },
  {
    label: 'Référentiels', icon: '◈', path: '/referentiels', module: 'referentiels',
    children: [
      { label: 'Articles', path: '/referentiels/articles' },
      { label: 'Fournisseurs', path: '/referentiels/fournisseurs' },
      { label: 'Clients', path: '/referentiels/clients' },
      { label: 'Sites', path: '/referentiels/sites' },
      { label: 'Postes de charge', path: '/referentiels/postes-charge' },
    ],
  },
  {
    label: 'Stocks', icon: '◪', path: '/stock', module: 'stock',
    children: [
      { label: 'Vue actuelle', path: '/stock/actuel' },
      { label: 'Lots', path: '/stock/lots' },
      { label: 'Mouvements', path: '/stock/mouvements' },
      { label: 'Inventaires', path: '/stock/inventaires' },
      { label: 'Alertes', path: '/stock/alertes' },
    ],
  },
  {
    label: 'Achats', icon: '◇', path: '/achats', module: 'achats',
    children: [
      { label: 'Demandes achat', path: '/achats/demandes' },
      { label: 'Commandes', path: '/achats/commandes' },
      { label: 'Réceptions', path: '/achats/receptions' },
      { label: 'MRP', path: '/achats/mrp' },
    ],
  },
  {
    label: 'Production', icon: '⬡', path: '/production', module: 'production',
    children: [
      { label: 'Ordres de fabrication', path: '/production/ordres' },
      { label: 'Nomenclatures', path: '/production/nomenclatures' },
      { label: 'Gammes', path: '/production/gammes' },
    ],
  },
  {
    label: 'Qualité', icon: '◉', path: '/qualite', module: 'qualite',
    children: [
      { label: 'Plans de contrôle', path: '/qualite/plans' },
      { label: 'Contrôles réception', path: '/qualite/controles' },
      { label: 'Non-conformités', path: '/qualite/nc' },
    ],
  },
  {
    label: 'Expéditions', icon: '◁', path: '/expeditions', module: 'expeditions',
    children: [
      { label: 'Commandes clients', path: '/expeditions/commandes' },
      { label: 'Bons de livraison', path: '/expeditions/bl' },
    ],
  },
  {
    label: 'Reporting', icon: '◈', path: '/reporting', module: 'reporting',
    children: [
      { label: 'Dashboard Directeur', path: '/reporting/dashboard' },
      { label: 'TRS Postes', path: '/reporting/trs' },
      { label: 'Écarts consommation', path: '/reporting/ecarts' },
      { label: 'Fournisseurs', path: '/reporting/fournisseurs' },
    ],
  },
  { label: 'RH', icon: '👥', path: '/rh', module: 'rh' },
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const toggleMenu = (path: string) => {
    setOpenMenus(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const visibleItems = NAV_ITEMS.filter(item =>
    item.always || canAccess(user.role, item.module)
  );

  return (
    <div className={`layout-root ${collapsed ? 'layout-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          {!collapsed && (
            <div className="sidebar-brand">
              <div className="sidebar-logo">
                <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                  <rect width="36" height="36" rx="10" fill="#0F4C81"/>
                  <path d="M8 26 L18 10 L28 26 Z" fill="none" stroke="#4FC3F7" strokeWidth="2" strokeLinejoin="round"/>
                  <circle cx="18" cy="18" r="3" fill="#4FC3F7"/>
                </svg>
              </div>
              <span className="sidebar-name">Supply Chain</span>
            </div>
          )}
          <button className="sidebar-toggle" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleItems.map(item => (
            <div key={item.path} className="nav-group">
              {item.children ? (
                <>
                  <button
                    className={`nav-item nav-parent ${openMenus.includes(item.path) ? 'open' : ''}`}
                    onClick={() => toggleMenu(item.path)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="nav-label">{item.label}</span>
                        <span className="nav-chevron">{openMenus.includes(item.path) ? '▾' : '▸'}</span>
                      </>
                    )}
                  </button>
                  {!collapsed && openMenus.includes(item.path) && (
                    <div className="nav-children">
                      {item.children.map(child => (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          className={({ isActive }) => `nav-child ${isActive ? 'active' : ''}`}
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && <span className="nav-label">{item.label}</span>}
                </NavLink>
              )}
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div className="sidebar-user">
            <div className="user-avatar">{user.prenom[0]}{user.nom[0]}</div>
            <div className="user-info">
              <div className="user-name">{user.prenom} {user.nom}</div>
              <div className="user-role">{ROLE_LABELS[user.role] || user.role}</div>
            </div>
            <button className="logout-btn" onClick={logout} title="Déconnexion">⏻</button>
          </div>
        )}
      </aside>

      <main className="layout-main">
        <Outlet />
      </main>

      {/* Agent IA contextuel — visible sur toutes les pages */}
      <AiAgent />
    </div>
  );
}
