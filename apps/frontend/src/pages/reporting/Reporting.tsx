import { useState } from 'react';
import {
  useKpisDirecteur, useTrs, useEcartsConsommation, useClassementFournisseurs,
} from '../../hooks/useQualiteExpeditions';
import { KpiCard, Table, Badge, Select } from '../../components/ui';

// ── Dashboard Directeur ───────────────────────────────────────────────────────
export function DashboardDirecteurPage() {
  const { data: kpis, isLoading } = useKpisDirecteur();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Directeur</h1>
          <p className="page-subtitle">
            KPIs temps réel — {kpis?.periode || new Date().toISOString().slice(0, 7)}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <KpiCard
          label="Valeur stock totale"
          value={isLoading ? '…' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact' }).format(kpis?.valeurTotaleStock || 0)}
          variant="info" icon="💰"
        />
        <KpiCard
          label="Taux de service"
          value={isLoading ? '…' : `${(kpis?.tauxServiceClient || 0).toFixed(1)}`}
          unit="%"
          variant={kpis?.tauxServiceClient >= 95 ? 'success' : kpis?.tauxServiceClient >= 85 ? 'warning' : 'danger'}
          icon="🚚"
        />
        <KpiCard
          label="Taux rebut"
          value={isLoading ? '…' : `${(kpis?.tauxRebutProduction || 0).toFixed(2)}`}
          unit="%"
          variant={kpis?.tauxRebutProduction <= 2 ? 'success' : kpis?.tauxRebutProduction <= 5 ? 'warning' : 'danger'}
          icon="♻️"
        />
        <KpiCard
          label="OF ce mois"
          value={isLoading ? '…' : `${kpis?.ofTermines || 0}/${kpis?.ofPlanifies || 0}`}
          variant={kpis?.ratioOf >= 90 ? 'success' : 'warning'}
          icon="🏭"
        />
        <KpiCard
          label="NC ouvertes"
          value={isLoading ? '…' : kpis?.nbNcOuvertes || 0}
          variant={kpis?.nbNcOuvertes === 0 ? 'success' : kpis?.nbNcOuvertes <= 5 ? 'warning' : 'danger'}
          icon="⚠️"
        />
        <KpiCard
          label="Ruptures"
          value={isLoading ? '…' : kpis?.nbArticlesRupture || 0}
          variant={kpis?.nbArticlesRupture === 0 ? 'success' : 'danger'}
          icon="🚨"
        />
        <KpiCard
          label="Sous stock mini"
          value={isLoading ? '…' : kpis?.nbArticlesSousMini || 0}
          variant={kpis?.nbArticlesSousMini === 0 ? 'success' : 'warning'}
          icon="📉"
        />
      </div>

      {/* Liens rapides */}
      <h3 style={{ color: '#5A7A90', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
        Accès rapides
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
        {[
          { label: 'Alertes stock', path: '/stock/alertes', icon: '🚨' },
          { label: 'Commandes achat', path: '/achats/commandes', icon: '📋' },
          { label: 'Ordres de fab.', path: '/production/ordres', icon: '🏭' },
          { label: 'Non-conformités', path: '/qualite/nc', icon: '⚠️' },
          { label: 'Expéditions', path: '/expeditions/bl', icon: '🚚' },
          { label: 'TRS Postes', path: '/reporting/trs', icon: '📊' },
        ].map(link => (
          <a key={link.path} href={link.path} style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '14px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(79,195,247,0.08)',
            borderRadius: '10px', textDecoration: 'none', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(79,195,247,0.25)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(79,195,247,0.08)'; }}
          >
            <span style={{ fontSize: '1.3rem' }}>{link.icon}</span>
            <span style={{ color: '#C4DCF0', fontWeight: 600, fontSize: '0.85rem' }}>{link.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── TRS Postes ────────────────────────────────────────────────────────────────
export function TrsPage() {
  const [periode, setPeriode] = useState(30);
  const { data: trs, isLoading } = useTrs(periode);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">TRS par poste de charge</h1>
          <p className="page-subtitle">Taux de rendement synthétique</p>
        </div>
        <Select value={String(periode)} onChange={v => setPeriode(Number(v))} options={[
          { value: '7', label: '7 jours' },
          { value: '30', label: '30 jours' },
          { value: '90', label: '90 jours' },
        ]} />
      </div>

      <Table
        loading={isLoading}
        data={trs || []}
        emptyText="Aucune donnée TRS — déclarez des productions sur les OF"
        columns={[
          { key: 'code', header: 'Code poste', width: '120px',
            render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.code}</span> },
          { key: 'libelle', header: 'Libellé' },
          { key: 'trs_pct', header: 'TRS réel', width: '120px',
            render: (r: any) => {
              const v = Number(r.trs_pct || 0);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '80px', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, v)}%`, height: '100%', background: v >= 85 ? '#4ADE80' : v >= 70 ? '#FCD34D' : '#FCA5A5', borderRadius: '4px' }} />
                  </div>
                  <span style={{ color: v >= 85 ? '#4ADE80' : v >= 70 ? '#FCD34D' : '#FCA5A5', fontWeight: 700 }}>{v.toFixed(1)}%</span>
                </div>
              );
            }},
          { key: 'taux_cible', header: 'Cible', width: '80px',
            render: (r: any) => <span style={{ color: '#3A6278' }}>{Number(r.taux_cible || 85).toFixed(0)}%</span> },
          { key: 'temps_utile_min', header: 'Temps utile', width: '110px',
            render: (r: any) => <span style={{ color: '#5A7A90' }}>{Math.round(Number(r.temps_utile_min || 0))}min</span> },
          { key: 'taux_rebut_pct', header: 'Taux rebut', width: '100px',
            render: (r: any) => <Badge variant={Number(r.taux_rebut_pct) <= 2 ? 'success' : 'warning'}>{Number(r.taux_rebut_pct || 0).toFixed(1)}%</Badge> },
        ]}
      />
    </div>
  );
}

// ── Écarts consommation + Classement fournisseurs ─────────────────────────────
export function EcartsReportingPage() {
  const { data: ecarts, isLoading } = useEcartsConsommation();
  const { data: fournisseurs } = useClassementFournisseurs();

  const NIVEAU_VARIANTS: Record<string, any> = {
    PREFERE: 'success', STANDARD: 'info', SURVEILLANCE: 'warning', BLOQUE: 'danger',
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rapports analytiques</h1>
          <p className="page-subtitle">Écarts consommation MP + Classement fournisseurs</p>
        </div>
      </div>

      <h3 style={{ color: '#5A7A90', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
        Écarts consommation MP — ce mois
      </h3>
      <Table
        loading={isLoading}
        data={ecarts || []}
        emptyText="Aucun écart ce mois"
        columns={[
          { key: 'of_reference', header: 'OF', width: '160px',
            render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.of_reference}</span> },
          { key: 'pf_reference', header: 'Produit fini',
            render: (r: any) => <span style={{ color: '#C4DCF0' }}>{r.pf_reference} — {r.pf_designation}</span> },
          { key: 'ecart_pct', header: 'Écart %', width: '90px',
            render: (r: any) => {
              const v = Number(r.ecart_pct || 0);
              return <span style={{ color: Math.abs(v) > 10 ? '#FCA5A5' : Math.abs(v) > 5 ? '#FCD34D' : '#4ADE80', fontWeight: 700 }}>
                {v > 0 ? '+' : ''}{v.toFixed(1)}%
              </span>;
            }},
          { key: 'ecart_valeur_eur', header: 'Écart (€)', width: '110px',
            render: (r: any) => <span style={{ color: '#FCD34D', fontWeight: 600 }}>{Number(r.ecart_valeur_eur || 0).toFixed(2)} €</span> },
        ]}
      />

      <h3 style={{ color: '#5A7A90', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '24px 0 12px' }}>
        Classement fournisseurs par score qualité
      </h3>
      <Table
        data={fournisseurs || []}
        emptyText="Aucun fournisseur"
        columns={[
          { key: 'code', header: 'Code', width: '110px',
            render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.code}</span> },
          { key: 'raison_sociale', header: 'Fournisseur' },
          { key: 'score_qualite', header: 'Score', width: '140px',
            render: (r: any) => {
              const v = Number(r.score_qualite || 0);
              const color = v >= 90 ? '#4ADE80' : v >= 70 ? '#4FC3F7' : v >= 50 ? '#FCD34D' : '#FCA5A5';
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, v)}%`, height: '100%', background: color, borderRadius: '3px' }} />
                  </div>
                  <span style={{ color, fontWeight: 700 }}>{v.toFixed(0)}</span>
                </div>
              );
            }},
          { key: 'niveau', header: 'Niveau', width: '120px',
            render: (r: any) => <Badge variant={NIVEAU_VARIANTS[r.niveau] || 'neutral'}>{r.niveau}</Badge> },
          { key: 'statut', header: 'Statut', width: '90px',
            render: (r: any) => <Badge variant={r.statut === 'ACTIF' ? 'success' : 'neutral'}>{r.statut}</Badge> },
        ]}
      />
    </div>
  );
}
