import { useState } from 'react';
import { useStockActuel, useStockAlertes } from '../../hooks/useStock';
import { Table, Badge, Button, SearchInput, Select, KpiCard } from '../../components/ui';
import { useSites } from '../../hooks/useReferentiels';

const STATUT_VARIANTS: Record<string, any> = {
  RUPTURE: 'danger', CRITIQUE: 'danger', ALERTE: 'warning', SURSTOCK: 'accent', OK: 'success',
};

export function StockActuelPage() {
  const [search, setSearch] = useState('');
  const [siteId, setSiteId] = useState('');
  const { data: sites } = useSites();
  const { data, isLoading } = useStockActuel({
    search: search || undefined,
    siteId: siteId || undefined,
  });

  const stock = data?.data || [];
  const total = data?.total || 0;

  const valeurTotale = stock.reduce((a: number, s: any) => a + parseFloat(s.valeur_stock || 0), 0);
  const enRupture = stock.filter((s: any) => parseFloat(s.stock_disponible) <= 0).length;
  const critiques = stock.filter((s: any) => parseFloat(s.stock_disponible) > 0 && parseFloat(s.stock_disponible) <= parseFloat(s.stock_mini)).length;

  const siteOptions = (sites || []).map((s: any) => ({ value: s.id, label: `${s.code} — ${s.nom}` }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock actuel</h1>
          <p className="page-subtitle">{total} articles — vue temps réel</p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <KpiCard label="Valeur totale" value={new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact' }).format(valeurTotale)} variant="info" icon="💰" />
        <KpiCard label="En rupture" value={enRupture} variant={enRupture === 0 ? 'success' : 'danger'} icon="🚨" />
        <KpiCard label="Critiques" value={critiques} variant={critiques === 0 ? 'success' : 'warning'} icon="⚠️" />
        <KpiCard label="Articles suivis" value={total} variant="neutral" icon="📦" />
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Référence, désignation..." />
        <Select value={siteId} onChange={setSiteId} options={siteOptions} placeholder="Tous les sites" />
      </div>

      <Table
        loading={isLoading}
        data={stock}
        emptyText="Aucun stock"
        columns={[
          { key: 'reference', header: 'Référence', width: '140px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.reference}</span> },
          { key: 'designation', header: 'Désignation' },
          { key: 'statut_alerte', header: 'Statut', width: '100px',
            render: r => <Badge variant={STATUT_VARIANTS[r.statut_alerte] || 'neutral'}>{r.statut_alerte}</Badge> },
          { key: 'stock_actuel', header: 'Stock total', width: '110px',
            render: r => <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{Number(r.stock_actuel || 0).toFixed(2)} {r.unite_mesure}</span> },
          { key: 'stock_disponible', header: 'Disponible', width: '110px',
            render: r => {
              const v = Number(r.stock_disponible || 0);
              return <span style={{ color: v <= 0 ? '#FCA5A5' : v <= r.stock_mini ? '#FCD34D' : '#4ADE80', fontWeight: 600 }}>{v.toFixed(2)}</span>;
            }},
          { key: 'stock_reserve', header: 'Réservé', width: '90px',
            render: r => <span style={{ color: '#5A7A90' }}>{Number(r.stock_reserve || 0).toFixed(2)}</span> },
          { key: 'stock_mini', header: 'Stock mini', width: '90px',
            render: r => <span style={{ color: '#3A6278' }}>{Number(r.stock_mini || 0).toFixed(2)}</span> },
          { key: 'valeur_stock', header: 'Valeur', width: '110px',
            render: r => Number(r.valeur_stock || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) },
        ]}
      />
    </div>
  );
}

export function AlertesStockPage() {
  const { data: alertes, isLoading, refetch } = useStockAlertes();

  const parStatut: Record<string, any[]> = {};
  (alertes || []).forEach((a: any) => {
    if (!parStatut[a.statut_alerte]) parStatut[a.statut_alerte] = [];
    parStatut[a.statut_alerte].push(a);
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alertes stock</h1>
          <p className="page-subtitle">{(alertes || []).length} articles nécessitent attention</p>
        </div>
        <Button variant="secondary" onClick={() => refetch()}>↻ Actualiser</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {['RUPTURE', 'CRITIQUE', 'ALERTE', 'SURSTOCK'].map(s => (
          <KpiCard key={s} label={s} value={(parStatut[s] || []).length}
            variant={STATUT_VARIANTS[s]} />
        ))}
      </div>

      <Table
        loading={isLoading}
        data={alertes || []}
        emptyText="✅ Aucune alerte — tous les stocks sont OK"
        columns={[
          { key: 'statut_alerte', header: 'Statut', width: '100px',
            render: r => <Badge variant={STATUT_VARIANTS[r.statut_alerte]}>{r.statut_alerte}</Badge> },
          { key: 'reference', header: 'Référence', width: '140px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.reference}</span> },
          { key: 'designation', header: 'Désignation' },
          { key: 'stock_disponible', header: 'Dispo', width: '90px',
            render: r => {
              const v = Number(r.stock_disponible || 0);
              return <span style={{ color: v <= 0 ? '#FCA5A5' : '#FCD34D', fontWeight: 700 }}>{v.toFixed(2)}</span>;
            }},
          { key: 'stock_mini', header: 'Mini', width: '80px',
            render: r => <span style={{ color: '#3A6278' }}>{Number(r.stock_mini || 0).toFixed(2)}</span> },
          { key: 'couverture_jours', header: 'Couverture', width: '100px',
            render: r => {
              const j = Number(r.couverture_jours || 0);
              return <span style={{ color: j <= 0 ? '#FCA5A5' : j <= 7 ? '#FCD34D' : '#4ADE80' }}>{j === 0 ? 'Rupture' : `${j}j`}</span>;
            }},
          { key: 'unite_mesure', header: 'Unité', width: '70px',
            render: r => <span style={{ color: '#5A7A90' }}>{r.unite_mesure}</span> },
        ]}
      />
    </div>
  );
}
