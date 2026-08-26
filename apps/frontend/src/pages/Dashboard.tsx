import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.context';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────
interface Kpis {
  valeur_stock: number;
  ruptures: number;
  critiques: number;
  nc_ouvertes: number;
  nc_critiques: number;
  of_en_cours: number;
  of_planifies: number;
  da_attente: number;
  taux_rebut: number;
  taux_service: number;
}

interface StockItem {
  reference: string;
  designation: string;
  disponible: number;
  mini: number;
  unite_mesure: string;
  statut: 'RUPTURE' | 'CRITIQUE' | 'ALERTE' | 'OK';
}

interface OfItem {
  reference: string;
  article: string;
  statut: string;
  quantite_prevue: number;
  quantite_produite: number;
  avancement: number;
}

interface NcItem {
  reference: string;
  severite: string;
  statut: string;
  article: string;
  description: string;
}

// ── Helpers ───────────────────────────────────────────────────
const statutColor = (s: string) => {
  if (s === 'RUPTURE') return '#F87171';
  if (s === 'CRITIQUE') return '#FB923C';
  if (s === 'ALERTE') return '#FCD34D';
  return '#34D399';
};

const statutBg = (s: string) => {
  if (s === 'RUPTURE') return 'rgba(248,113,113,0.1)';
  if (s === 'CRITIQUE') return 'rgba(251,146,60,0.1)';
  if (s === 'ALERTE') return 'rgba(252,211,77,0.1)';
  return 'rgba(52,211,153,0.1)';
};

const ofColor = (statut: string) => {
  if (statut === 'CLOS') return '#34D399';
  if (statut === 'EN_COURS' || statut === 'LANCE') return '#4FC3F7';
  if (statut === 'PLANIFIE') return '#A78BFA';
  return '#4A6880';
};

const severiteColor = (s: string) => {
  if (s === 'CRITIQUE') return '#F87171';
  if (s === 'MAJEURE') return '#FB923C';
  return '#FCD34D';
};

// ── Composants UI ─────────────────────────────────────────────
const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: '#111E2E',
    border: '1px solid rgba(79,195,247,0.10)',
    borderRadius: 12,
    padding: 16,
    ...style,
  }}>
    {children}
  </div>
);

const KpiCard = ({
  label, value, unit = '', sub, color = '#4FC3F7', icon, danger = false,
}: {
  label: string; value: string | number; unit?: string;
  sub?: string; color?: string; icon: string; danger?: boolean;
}) => (
  <div style={{
    background: '#111E2E',
    border: `1px solid ${danger ? `${color}30` : 'rgba(79,195,247,0.10)'}`,
    borderRadius: 10, padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 4,
    transition: 'border-color 0.2s',
    cursor: 'default',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: '#4A6880', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: 16 }}>{icon}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
      <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      {unit && <span style={{ fontSize: 12, color: '#4A6880' }}>{unit}</span>}
    </div>
    {sub && <div style={{ fontSize: 11, color: '#7A9AB5' }}>{sub}</div>}
  </div>
);

const SectionTitle = ({ children, tag }: { children: React.ReactNode; tag?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
    <h2 style={{ fontSize: 11, fontWeight: 700, color: '#E8F4FD', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
      {children}
    </h2>
    {tag && (
      <span style={{
        fontSize: 10, padding: '2px 8px', borderRadius: 6,
        background: 'rgba(79,195,247,0.08)', color: '#4FC3F7',
        border: '1px solid rgba(79,195,247,0.15)',
      }}>{tag}</span>
    )}
  </div>
);

// ── Dashboard principal ───────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [ofs, setOfs] = useState<OfItem[]>([]);
  const [ncs, setNcs] = useState<NcItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const fetchData = useCallback(async () => {
    try {
      const [kpiRes, stockRes, ofRes, ncRes] = await Promise.all([
        api.get('/dashboard/live').catch(() => ({ data: null })),
        api.get('/dashboard/stock-chart').catch(() => ({ data: [] })),
        api.get('/dashboard/production-chart').catch(() => ({ data: [] })),
        api.get('/non-conformites?limit=5').catch(() => ({ data: { data: [] } })),
      ]);

      if (kpiRes.data) {
        const d = kpiRes.data;
        setKpis({
          valeur_stock: parseFloat(d.stock?.valeur_totale) || 0,
          ruptures: parseInt(d.stock?.ruptures) || 0,
          critiques: parseInt(d.stock?.critiques) || 0,
          nc_ouvertes: parseInt(d.qualite?.nc_ouvertes) || 0,
          nc_critiques: parseInt(d.qualite?.nc_critiques) || 0,
          of_en_cours: parseInt(d.production?.en_cours) || 0,
          of_planifies: parseInt(d.production?.planifies) || 0,
          da_attente: parseInt(d.achats?.da_attente) || 0,
          taux_rebut: parseFloat(d.production?.avancement_moyen) || 0,
          taux_service: 0,
        });
      }

      if (Array.isArray(stockRes.data)) {
        setStock(stockRes.data.slice(0, 8).map((r: any) => ({
          reference: r.reference,
          designation: r.designation,
          disponible: parseFloat(r.disponible) || 0,
          mini: parseFloat(r.mini) || 0,
          unite_mesure: r.unite_mesure,
          statut: r.statut || 'OK',
        })));
      }

      if (Array.isArray(ofRes.data)) {
        setOfs(ofRes.data.slice(0, 5).map((r: any) => ({
          reference: r.reference,
          article: r.article,
          statut: r.statut,
          quantite_prevue: parseFloat(r.quantite_prevue) || 0,
          quantite_produite: parseFloat(r.quantite_produite) || 0,
          avancement: parseFloat(r.avancement) || 0,
        })));
      }

      const ncData = ncRes.data?.data || ncRes.data || [];
      if (Array.isArray(ncData)) {
        setNcs(ncData.slice(0, 5).map((r: any) => ({
          reference: r.reference,
          severite: r.severite,
          statut: r.statut,
          article: r.article?.reference || '—',
          description: r.description || '',
        })));
      }

      setLastUpdate(new Date());
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Styles communs ───────────────────────────────────────────
  const S = {
    root: {
      minHeight: '100%',
      background: '#080F1C',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 16,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    } as React.CSSProperties,
  };

  if (loading) return (
    <div style={{ ...S.root, alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '2px solid rgba(79,195,247,0.15)',
        borderTopColor: '#4FC3F7',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  );

  const hasAlerts = (kpis?.ruptures || 0) > 0 || (kpis?.nc_critiques || 0) > 0;

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
        .dash-kpi:hover { border-color: rgba(79,195,247,0.25) !important; }
        .dash-row:hover td { background: rgba(79,195,247,0.025) !important; }
        .dash-module:hover { border-color: rgba(79,195,247,0.25) !important; background: rgba(79,195,247,0.04) !important; cursor:pointer; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#E8F4FD', margin: 0 }}>
            Tableau de bord
          </h1>
          <div style={{ fontSize: 12, color: '#4A6880', marginTop: 3 }}>
            Bienvenue, <span style={{ color: '#7A9AB5' }}>{user?.prenom} {user?.nom}</span> — {today}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, padding: '4px 10px', borderRadius: 20,
            background: 'rgba(52,211,153,0.08)', color: '#34D399',
            border: '1px solid rgba(52,211,153,0.2)',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', animation: 'pulse 2s infinite' }} />
            Live · {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button
            onClick={fetchData}
            style={{
              padding: '5px 12px', borderRadius: 8,
              border: '1px solid rgba(79,195,247,0.15)',
              background: 'rgba(79,195,247,0.06)', color: '#4FC3F7',
              fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >↻ Actualiser</button>
        </div>
      </div>

      {/* ── Alerte banner ── */}
      {hasAlerts && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', borderRadius: 10,
          background: 'rgba(248,113,113,0.06)',
          border: '1px solid rgba(248,113,113,0.18)',
          fontSize: 12, color: '#F87171',
          animation: 'fadeIn 0.3s ease',
        }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <span>
            <strong>Alertes actives</strong>
            {(kpis?.ruptures || 0) > 0 && ` · ${kpis!.ruptures} rupture(s) de stock`}
            {(kpis?.nc_critiques || 0) > 0 && ` · ${kpis!.nc_critiques} NC critique(s)`}
          </span>
          <button
            onClick={() => navigate('/qualite/nc')}
            style={{
              marginLeft: 'auto', background: 'rgba(248,113,113,0.12)',
              border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6,
              padding: '3px 12px', color: '#F87171', fontSize: 11,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Voir →</button>
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <KpiCard icon="💰" label="Valeur stock" color="#4FC3F7"
          value={kpis ? `${(kpis.valeur_stock / 1000).toFixed(1)}k` : '—'} unit="€"
          sub="Valeur totale inventaire" />
        <KpiCard icon="🚨" label="Ruptures" danger={( kpis?.ruptures || 0) > 0}
          color={(kpis?.ruptures || 0) > 0 ? '#F87171' : '#34D399'}
          value={kpis?.ruptures ?? '—'}
          sub={`${kpis?.critiques ?? 0} critiques`} />
        <KpiCard icon="🏭" label="OF en cours"  color="#4FC3F7"
          value={kpis?.of_en_cours ?? '—'}
          sub={`${kpis?.of_planifies ?? 0} planifiés`} />
        <KpiCard icon="⚠️" label="NC ouvertes" danger={(kpis?.nc_ouvertes || 0) > 0}
          color={(kpis?.nc_critiques || 0) > 0 ? '#F87171' : (kpis?.nc_ouvertes || 0) > 0 ? '#FB923C' : '#34D399'}
          value={kpis?.nc_ouvertes ?? '—'}
          sub={`${kpis?.nc_critiques ?? 0} critiques`} />
        <KpiCard icon="📋" label="DA en attente" color="#FCD34D"
          value={kpis?.da_attente ?? '—'} sub="À valider" />
        <KpiCard icon="📈" label="Avancement moy." color="#A78BFA"
          value={kpis ? `${kpis.taux_rebut.toFixed(0)}` : '—'} unit="%"
          sub="Production OF actifs" />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>

        {/* Stock chart */}
        <Card>
          <SectionTitle tag={`${stock.length} articles`}>Niveaux de stock</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stock.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#4A6880', padding: '24px', fontSize: 12 }}>
                Aucune donnée stock
              </div>
            ) : stock.map((s, i) => {
              const pct = s.mini > 0 ? Math.min((s.disponible / (s.mini * 2)) * 100, 100) : 60;
              return (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#7A9AB5', width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.reference}
                    </span>
                    <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: statutColor(s.statut), borderRadius: 4, transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#7A9AB5', width: 60, textAlign: 'right', flexShrink: 0 }}>
                      {s.disponible.toFixed(0)} {s.unite_mesure}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                      background: statutBg(s.statut), color: statutColor(s.statut),
                      width: 56, textAlign: 'center', flexShrink: 0,
                    }}>{s.statut}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* OF progress */}
        <Card>
          <SectionTitle tag="Live">Ordres de fabrication</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ofs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#4A6880', padding: '24px', fontSize: 12 }}>Aucun OF actif</div>
            ) : ofs.map((of, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#E8F4FD' }}>{of.reference}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                      background: `${ofColor(of.statut)}15`, color: ofColor(of.statut),
                    }}>{of.statut.replace('_', ' ')}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#7A9AB5' }}>{of.avancement.toFixed(0)}%</span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(of.avancement, 100)}%`, height: '100%',
                    background: of.avancement >= 100 ? '#34D399' : ofColor(of.statut),
                    borderRadius: 3, transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: '#4A6880', marginTop: 3 }}>
                  {of.quantite_produite.toFixed(0)} / {of.quantite_prevue.toFixed(0)} pces · {of.article}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── NC Table ── */}
      {ncs.length > 0 && (
        <Card>
          <SectionTitle tag={`${ncs.length} ouvertes`}>Non-conformités ouvertes</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Référence', 'Sévérité', 'Article', 'Description', 'Statut'].map(h => (
                  <th key={h} style={{
                    padding: '6px 12px', textAlign: 'left', color: '#4A6880',
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.07em', borderBottom: '1px solid rgba(79,195,247,0.08)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ncs.map((nc, i) => (
                <tr key={i} className="dash-row">
                  <td style={{ padding: '9px 12px', color: '#E8F4FD', fontWeight: 700, borderBottom: '1px solid rgba(79,195,247,0.04)' }}>{nc.reference}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(79,195,247,0.04)' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: `${severiteColor(nc.severite)}15`, color: severiteColor(nc.severite),
                    }}>{nc.severite}</span>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#7A9AB5', borderBottom: '1px solid rgba(79,195,247,0.04)' }}>{nc.article}</td>
                  <td style={{ padding: '9px 12px', color: '#7A9AB5', borderBottom: '1px solid rgba(79,195,247,0.04)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nc.description}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(79,195,247,0.04)' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: 'rgba(251,146,60,0.1)', color: '#FB923C',
                    }}>{nc.statut.replace(/_/g, ' ')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Modules raccourcis ── */}
      <Card>
        <SectionTitle>Accès rapides</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {[
            { icon: '📦', label: 'Alertes stock', sub: 'Ruptures et critiques', path: '/stock/alertes', color: '#F87171' },
            { icon: '🛒', label: 'Commandes achat', sub: 'En cours', path: '/achats/commandes', color: '#4FC3F7' },
            { icon: '🏭', label: 'Ordres de fab.', sub: 'Lancés', path: '/production/ordres', color: '#4FC3F7' },
            { icon: '⚠️', label: 'Non-conformités', sub: 'Ouvertes', path: '/qualite/nc', color: '#FB923C' },
            { icon: '🚚', label: 'Expéditions', sub: 'À expédier', path: '/expeditions/commandes', color: '#A78BFA' },
            { icon: '📊', label: 'Reporting', sub: 'KPIs', path: '/reporting', color: '#34D399' },
          ].map((m, i) => (
            <button
              key={i}
              onClick={() => navigate(m.path)}
              className="dash-module"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(79,195,247,0.08)',
                borderRadius: 10, padding: '14px',
                display: 'flex', flexDirection: 'column', gap: 8,
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 22 }}>{m.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#E8F4FD' }}>{m.label}</div>
                <div style={{ fontSize: 10, color: '#4A6880', marginTop: 2 }}>{m.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}