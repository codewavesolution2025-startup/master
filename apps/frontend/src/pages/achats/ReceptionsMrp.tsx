import { useState } from 'react';
import { useReceptions, useCreateReception, useMrpBesoinsNets } from '../../hooks/useAchats';
import { useCommandesAchat } from '../../hooks/useAchats';
import { useSites } from '../../hooks/useReferentiels';
import { Table, Badge, Button, Modal, Select, FormField, Input, KpiCard } from '../../components/ui';

// ── Page Réceptions ───────────────────────────────────────────────────────────
export function ReceptionsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ commandeAchatId: '', siteId: '', blFournisseur: '' });

  const { data: receptions, isLoading } = useReceptions();
  const { data: commandesData } = useCommandesAchat({ statut: 'ENVOYEE' });
  const { data: commandesEnCours } = useCommandesAchat({ statut: 'EN_COURS' });
  const { data: commandesArRecu } = useCommandesAchat({ statut: 'AR_RECU' });
  const { data: sites } = useSites();
  const createReception = useCreateReception();

  const allCommandes = [
    ...(commandesData?.data || []),
    ...(commandesEnCours?.data || []),
    ...(commandesArRecu?.data || []),
  ];

  const caOptions = allCommandes.map((ca: any) => ({
    value: ca.id,
    label: `${ca.reference} — ${ca.fournisseur?.raisonSociale}`,
  }));
  const siteOptions = (sites || []).map((s: any) => ({ value: s.id, label: `${s.code} — ${s.nom}` }));
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    try {
      await createReception.mutateAsync(form);
      setShowCreate(false);
      setForm({ commandeAchatId: '', siteId: '', blFournisseur: '' });
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Réceptions</h1>
          <p className="page-subtitle">Entrées en stock depuis commandes fournisseurs</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nouvelle réception</Button>
      </div>

      <Table
        loading={isLoading}
        data={receptions || []}
        emptyText="Aucune réception"
        columns={[
          { key: 'reference', header: 'Référence', width: '150px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.reference}</span> },
          { key: 'commandeAchat', header: 'Commande achat',
            render: r => (
              <div>
                <span style={{ color: '#C4DCF0' }}>{r.commandeAchat?.reference}</span>
                <span style={{ color: '#3A6278', marginLeft: '8px', fontSize: '0.78rem' }}>{r.commandeAchat?.fournisseur?.raisonSociale}</span>
              </div>
            )},
          { key: 'statut', header: 'Statut', width: '110px',
            render: r => <Badge variant={r.statut === 'VALIDE' ? 'success' : 'warning'}>{r.statut || 'EN_COURS'}</Badge> },
          { key: 'blFournisseur', header: 'BL Fournisseur', width: '140px',
            render: r => <span style={{ color: '#5A7A90', fontSize: '0.82rem' }}>{r.blFournisseur || '—'}</span> },
          { key: 'createdAt', header: 'Date', width: '110px',
            render: r => <span style={{ color: '#3A6278', fontSize: '0.8rem' }}>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</span> },
        ]}
      />

      {showCreate && (
        <Modal title="Nouvelle réception" onClose={() => setShowCreate(false)}>
          <FormField label="Commande achat" required>
            <Select value={form.commandeAchatId} onChange={set('commandeAchatId')}
              options={caOptions} placeholder="Sélectionner une CA envoyée..." />
          </FormField>
          <FormField label="Site de réception" required>
            <Select value={form.siteId} onChange={set('siteId')} options={siteOptions} placeholder="Sélectionner un site" />
          </FormField>
          <FormField label="N° BL Fournisseur">
            <Input value={form.blFournisseur} onChange={set('blFournisseur')} placeholder="BL-FOUR-2026-001" />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createReception.isPending}>Créer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Page MRP ──────────────────────────────────────────────────────────────────
export function MrpPage() {
  const [horizon, setHorizon] = useState(30);
  const { data, isLoading, refetch } = useMrpBesoinsNets(horizon);

  const besoins = data?.besoins || [];
  const nbArticles = data?.nbArticles || 0;

  const urgents = besoins.filter((b: any) => {
    const dateReq = b.date_commande_requise ? new Date(b.date_commande_requise) : null;
    return dateReq && dateReq < new Date();
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">MRP — Besoins nets</h1>
          <p className="page-subtitle">
            {data?.dateCalcul ? `Calculé le ${new Date(data.dateCalcul).toLocaleString('fr-FR')}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Select value={String(horizon)} onChange={v => setHorizon(Number(v))}
            options={[
              { value: '30', label: '30 jours' },
              { value: '60', label: '60 jours' },
              { value: '90', label: '90 jours' },
            ]} />
          <Button variant="secondary" onClick={() => refetch()}>↻ Recalculer</Button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <KpiCard label="Articles en besoin" value={nbArticles} variant={nbArticles === 0 ? 'success' : 'warning'} icon="📋" />
        <KpiCard label="Urgents (date dépassée)" value={urgents.length} variant={urgents.length === 0 ? 'success' : 'danger'} icon="🚨" />
        <KpiCard label="Horizon d'analyse" value={horizon} unit="jours" variant="info" icon="📅" />
      </div>

      {/* Tableau besoins */}
      <Table
        loading={isLoading}
        data={besoins}
        emptyText="✅ Aucun besoin net — tous les articles sont couverts"
        columns={[
          { key: 'reference', header: 'Référence', width: '140px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.reference}</span> },
          { key: 'designation', header: 'Désignation' },
          { key: 'besoin_brut', header: 'Besoin brut', width: '110px',
            render: r => <span style={{ color: '#C4DCF0' }}>{Number(r.besoin_brut).toFixed(2)} {r.unite_mesure}</span> },
          { key: 'stock_disponible', header: 'Stock dispo', width: '110px',
            render: r => <span style={{ color: Number(r.stock_disponible) > 0 ? '#4ADE80' : '#FCA5A5', fontWeight: 600 }}>
              {Number(r.stock_disponible).toFixed(2)}
            </span> },
          { key: 'en_commande', header: 'En cde', width: '90px',
            render: r => <span style={{ color: '#5A7A90' }}>{Number(r.en_commande).toFixed(2)}</span> },
          { key: 'besoin_net', header: 'Besoin net', width: '110px',
            render: r => <span style={{ color: '#FCD34D', fontWeight: 700 }}>{Number(r.besoin_net).toFixed(2)}</span> },
          { key: 'date_commande_requise', header: 'Commander avant', width: '140px',
            render: r => {
              if (!r.date_commande_requise) return '—';
              const d = new Date(r.date_commande_requise);
              const retard = d < new Date();
              return (
                <span style={{ color: retard ? '#FCA5A5' : '#5A7A90', fontWeight: retard ? 700 : 400, fontSize: '0.82rem' }}>
                  {retard ? '⚠ ' : ''}{d.toLocaleDateString('fr-FR')}
                </span>
              );
            }},
          { key: 'actions', header: '', width: '100px',
            render: () => (
              <Button size="sm" variant="secondary"
                onClick={() => window.location.href = '/achats/demandes'}>
                Créer DA
              </Button>
            )},
        ]}
      />
    </div>
  );
}
