import { useState } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth, canAccess, ROLE_LABELS } from '../store/auth.context';
import AiAgent from '../components/ai/AiAgent';
import './MainLayout.css';

// ── Compte démo restreint ────────────────────────────────────
// Le rôle LECTURE ne peut voir/atteindre que cette unique page —
// « Portefeuille Clients » (les entreprises ayant déployé la
// solution) ; tout le reste du menu est affiché mais grisé
// (non cliquable), et toute navigation directe par URL y est
// également bloquée.
const DEMO_ROLE = 'LECTURE';
const DEMO_ONLY_PATH = '/admin/deploiements';

const NAV_ITEMS = [
  { label: 'Tableau de bord', icon: '⊙', path: '/dashboard', module: 'dashboard', always: true },
  {
    label: 'Référentiels', icon: '◆', path: '/referentiels', module: 'referentiels',
    children: [
      { label: 'Articles', path: '/referentiels/articles' },
      { label: 'Fournisseurs', path: '/referentiels/fournisseurs' },
      { label: 'Clients', path: '/referentiels/clients' },
      { label: 'Sites', path: '/referentiels/sites' },
      { label: 'Postes de charge', path: '/referentiels/postes-charge' },
    ],
  },
  {
    label: 'Stocks', icon: '▣', path: '/stock', module: 'stock',
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
    label: 'Production', icon: '⊙', path: '/production', module: 'production',
    children: [
      { label: 'Ordres de fabrication', path: '/production/ordres' },
      { label: 'Nomenclatures', path: '/production/nomenclatures' },
      { label: 'Gammes', path: '/production/gammes' },
    ],
  },
  {
    label: 'Qualité', icon: '●', path: '/qualite', module: 'qualite',
    children: [
      { label: 'Plans contrôle', path: '/qualite/plans' },
      { label: 'Contrôles', path: '/qualite/controles' },
      { label: 'Non-conformités', path: '/qualite/nc' },
    ],
  },
  {
    label: 'Expéditions', icon: '◁', path: '/expeditions', module: 'expeditions',
    children: [
      { label: 'Commandes clients', path: '/expeditions/commandes' },
      { label: 'Bons livraison', path: '/expeditions/bons-livraison' },
    ],
  },
  {
    label: 'Reporting', icon: '●', path: '/reporting', module: 'reporting',
    children: [
      { label: 'Dashboard directeur', path: '/reporting/dashboard' },
      { label: 'TRS', path: '/reporting/trs' },
      { label: 'Écarts', path: '/reporting/ecarts' },
    ],
  },
  { label: 'RH', icon: '👥', path: '/rh', module: 'rh', always: true },
  { label: 'Portefeuille Clients', icon: '🏭', path: '/admin/deploiements', module: 'admin', always: true },
];

// ── Types ─────────────────────────────────────────────────────
interface NavChild { label: string; path: string; }
interface NavItemDef {
  label: string; icon?: string; path: string;
  module?: string; always?: boolean; children?: NavChild[];
}

// ── Composant NavItem ─────────────────────────────────────────
function NavItem({
  item, collapsed, restricted,
}: { item: NavItemDef; collapsed: boolean; restricted: boolean }) {
  const [open, setOpen] = useState(false);

  if (item.children) {
    return (
      <div>
        <button
          className={`nav-item ${open ? 'active' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          <span className="nav-icon">{item.icon}</span>
          {!collapsed && <span className="nav-label">{item.label}</span>}
          {!collapsed && <span className="nav-chevron">{open ? '▾' : '▸'}</span>}
        </button>
        {open && !collapsed && (
          <div className="nav-children">
            {item.children.map((child) => {
              const locked = restricted && child.path !== DEMO_ONLY_PATH;
              if (locked) {
                return (
                  <span
                    key={child.path}
                    className="nav-child nav-child-disabled"
                    aria-disabled="true"
                    title="Non disponible avec ce compte démo"
                  >
                    {child.label}
                  </span>
                );
              }
              return (
                <NavLink
                  key={child.path}
                  to={child.path}
                  className={({ isActive }) => `nav-child${isActive ? ' active' : ''}`}
                >
                  {child.label}
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const locked = restricted && item.path !== DEMO_ONLY_PATH;
  if (locked) {
    return (
      <span
        className="nav-item nav-item-disabled"
        aria-disabled="true"
        title="Non disponible avec ce compte démo"
      >
        <span className="nav-icon">{item.icon}</span>
        {!collapsed && <span className="nav-label">{item.label}</span>}
      </span>
    );
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      <span className="nav-icon">{item.icon}</span>
      {!collapsed && <span className="nav-label">{item.label}</span>}
    </NavLink>
  );
}

// ── Layout principal ──────────────────────────────────────────
export default function MainLayout() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;

  const isDemoRestricted = user.role === DEMO_ROLE;

  // Bloque aussi la navigation directe par URL (pas seulement le menu grisé)
  if (isDemoRestricted && location.pathname !== DEMO_ONLY_PATH) {
    return <Navigate to={DEMO_ONLY_PATH} replace />;
  }

  const initials = `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase();

  return (
    <div className={`layout-root${collapsed ? ' layout-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 20 L12 6 L20 20 Z" stroke="#4FC3F7" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="2" fill="#4FC3F7" />
              </svg>
            </div>
            {!collapsed && <span className="sidebar-name">Supply Chain</span>}
          </div>
          <button className="sidebar-toggle" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <NavItem
              key={item.path}
              item={item}
              collapsed={collapsed}
              restricted={isDemoRestricted}
            />
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          {!collapsed && (
            <div className="user-info">
              <div className="user-name">{user.prenom} {user.nom}</div>
              <div className="user-role">{ROLE_LABELS[user.role] || user.role}</div>
            </div>
          )}
          <button className="logout-btn" onClick={logout} title="Déconnexion">⏻</button>
        </div>
      </aside>

      <main className="layout-main">
        <Outlet />
      </main>

      <AiAgent />
    </div>
  );
}
// commentaire