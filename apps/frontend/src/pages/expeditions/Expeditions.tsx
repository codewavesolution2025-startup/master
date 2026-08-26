import { useState } from 'react';
import {
  useCommandesClients, useCreateCC, useAddLigneCC,
  useBonsLivraison, useCreateBL, useExpedierBL,
} from '../../hooks/useQualiteExpeditions';
import { useClients, useArticles } from '../../hooks/useReferentiels';
import { Table, Badge, Button, Modal, Select, FormField, Input, KpiCard } from '../../components/ui';

const STATUT_CC_VARIANTS: Record<string, any> = {
  RECUE: 'info', EN_PREPARATION: 'warning', PARTIELLEMENT_EXPEDIEE: 'accent',
  EXPEDIEE: 'success', LIVREE: 'success', ANNULEE: 'danger',
};

const STATUT_BL_VARIANTS: Record<string, any> = {
  PREPARE: 'neutral', EXPEDIE: 'warning', LIVRE: 'success',
};

// ── Commandes clients ─────────────────────────────────────────────────────────
export function CommandesClientsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({ clientId: '', dateLivraisonPrev: '', devise: 'EUR', notes: '' });
  const [ligneForm, setLigneForm] = useState({ articleId: '', quantiteCommandee: '', prixUnitaire: '' });

  const { data: ccs, isLoading } = useCommandesClients();
  const { data: clients } = useClients();
  const { data: articlesData } = useArticles({ limit: 200 });
  const createCC = useCreateCC();
  const addLigne = useAddLigneCC(detailId || '');

  const ccList = ccs?.data || ccs || [];
  const clientOptions = (clients || []).map((c: any) => ({ value: c.id, label: `${c.code} — ${c.raisonSociale}` }));
  const articleOptions = (articlesData?.data || []).map((a: any) => ({ value: a.id, label: `${a.reference} — ${a.designation}` }));

  const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const setL = (k: string) => (v: string) => setLigneForm((f: any) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    try {
      await createCC.mutateAsync({ ...form, dateLivraisonPrev: form.dateLivraisonPrev || undefined });
      setShowCreate(false);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleAddLigne = async () => {
    try {
      await addLigne.mutateAsync({
        ...ligneForm,
        quantiteCommandee: Number(ligneForm.quantiteCommandee),
        prixUnitaire: Number(ligneForm.prixUnitaire),
      });
      setLigneForm({ articleId: '', quantiteCommandee: '', prixUnitaire: '' });
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Commandes clients</h1>
          <p className="page-subtitle">{ccList.length} commandes</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nouvelle CC</Button>
      </div>

      <Table
        loading={isLoading}
        data={ccList}
        emptyText="Aucune commande client"
        onRowClick={(r: any) => setDetailId(r.id)}
        columns={[
          { key: 'reference', header: 'Référence', width: '150px',
            render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.reference}</span> },
          { key: 'client', header: 'Client',
            render: (r: any) => <span style={{ color: '#C4DCF0' }}>{r.client?.raisonSociale}</span> },
          { key: 'statut', header: 'Statut', width: '160px',
            render: (r: any) => <Badge variant={STATUT_CC_VARIANTS[r.statut] || 'neutral'}>{r.statut?.replace(/_/g, ' ')}</Badge> },
          { key: 'montantHt', header: 'Montant HT', width: '120px',
            render: (r: any) => <span style={{ color: '#4ADE80', fontWeight: 600 }}>{Number(r.montantHt || 0).toLocaleString('fr-FR')} €</span> },
          { key: 'dateLivraisonPrev', header: 'Livraison prév.', width: '130px',
            render: (r: any) => r.dateLivraisonPrev
              ? <span style={{ color: '#5A7A90', fontSize: '0.82rem' }}>{new Date(r.dateLivraisonPrev).toLocaleDateString('fr-FR')}</span>
              : '—' },
          { key: 'createdAt', header: 'Date', width: '110px',
            render: (r: any) => <span style={{ color: '#3A6278', fontSize: '0.8rem' }}>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</span> },
        ]}
      />

      {/* Detail CC avec lignes */}
      {detailId && (
        <Modal title="Commande client" onClose={() => setDetailId(null)} width="700px">
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ color: '#5A7A90', fontSize: '0.78rem', textTransform: 'uppercase', marginBottom: '10px' }}>Ajouter une ligne</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
              <FormField label="Article">
                <Select value={ligneForm.articleId} onChange={setL('articleId')} options={articleOptions} placeholder="Article..." />
              </FormField>
              <FormField label="Quantité">
                <Input value={ligneForm.quantiteCommandee} onChange={setL('quantiteCommandee')} type="number" />
              </FormField>
              <FormField label="Prix unit. (€)">
                <Input value={ligneForm.prixUnitaire} onChange={setL('prixUnitaire')} type="number" />
              </FormField>
              <Button onClick={handleAddLigne} disabled={!ligneForm.articleId}>+</Button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setDetailId(null)}>Fermer</Button>
          </div>
        </Modal>
      )}

      {showCreate && (
        <Modal title="Nouvelle commande client" onClose={() => setShowCreate(false)}>
          <FormField label="Client" required>
            <Select value={form.clientId} onChange={set('clientId')} options={clientOptions} placeholder="Sélectionner..." />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Date livraison prévue">
              <Input value={form.dateLivraisonPrev} onChange={set('dateLivraisonPrev')} type="date" />
            </FormField>
            <FormField label="Devise">
              <Select value={form.devise} onChange={set('devise')} options={[
                { value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' },
              ]} />
            </FormField>
          </div>
          <FormField label="Notes">
            <Input value={form.notes} onChange={set('notes')} placeholder="Instructions particulières..." />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createCC.isPending}>Créer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Bons de livraison ─────────────────────────────────────────────────────────
export function BonsLivraisonPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ commandeId: '', transporteur: '', numeroTracking: '', nbColis: '1' });

  const { data: bls, isLoading } = useBonsLivraison();
  const { data: ccs } = useCommandesClients({ statut: 'RECUE' });
  const { data: ccsEnPrep } = useCommandesClients({ statut: 'EN_PREPARATION' });
  const createBL = useCreateBL();
  const expedier = useExpedierBL();

  const blList = Array.isArray(bls) ? bls : [];
  const allCCs = [...(ccs?.data || ccs || []), ...(ccsEnPrep?.data || ccsEnPrep || [])];
  const ccOptions = allCCs.map((cc: any) => ({ value: cc.id, label: `${cc.reference} — ${cc.client?.raisonSociale}` }));

  const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    try {
      await createBL.mutateAsync({ ...form, nbColis: Number(form.nbColis) });
      setShowCreate(false);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const aExpedie = blList.filter((bl: any) => bl.statut === 'EXPEDIE').length;
  const aLivrer = blList.filter((bl: any) => bl.statut === 'PREPARE').length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bons de livraison</h1>
          <p className="page-subtitle">{blList.length} bons</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nouveau BL</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <KpiCard label="À expédier" value={aLivrer} variant={aLivrer === 0 ? 'success' : 'warning'} icon="📦" />
        <KpiCard label="Expédiés" value={aExpedie} variant="info" icon="🚚" />
        <KpiCard label="Total" value={blList.length} variant="neutral" icon="📋" />
      </div>

      <Table
        loading={isLoading}
        data={blList}
        emptyText="Aucun bon de livraison"
        columns={[
          { key: 'reference', header: 'Référence', width: '150px',
            render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.reference}</span> },
          { key: 'commande', header: 'Commande client',
            render: (r: any) => <span style={{ color: '#C4DCF0' }}>{r.commande?.reference}</span> },
          { key: 'statut', header: 'Statut', width: '110px',
            render: (r: any) => <Badge variant={STATUT_BL_VARIANTS[r.statut] || 'neutral'}>{r.statut}</Badge> },
          { key: 'transporteur', header: 'Transporteur', width: '130px',
            render: (r: any) => <span style={{ color: '#5A7A90', fontSize: '0.82rem' }}>{r.transporteur || '—'}</span> },
          { key: 'numeroTracking', header: 'Tracking', width: '130px',
            render: (r: any) => <span style={{ color: '#5A7A90', fontSize: '0.82rem' }}>{r.numeroTracking || '—'}</span> },
          { key: 'nbColis', header: 'Colis', width: '70px',
            render: (r: any) => <span style={{ color: '#5A7A90' }}>{r.nbColis}</span> },
          { key: 'actions', header: '', width: '110px',
            render: (r: any) => r.statut === 'PREPARE' && (
              <Button size="sm" variant="secondary" onClick={() => expedier.mutateAsync(r.id)}>
                📤 Expédier
              </Button>
            )},
        ]}
      />

      {showCreate && (
        <Modal title="Nouveau bon de livraison" onClose={() => setShowCreate(false)}>
          <FormField label="Commande client" required>
            <Select value={form.commandeId} onChange={set('commandeId')} options={ccOptions} placeholder="Sélectionner..." />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Transporteur">
              <Input value={form.transporteur} onChange={set('transporteur')} placeholder="DHL, UPS..." />
            </FormField>
            <FormField label="N° tracking">
              <Input value={form.numeroTracking} onChange={set('numeroTracking')} placeholder="1Z999..." />
            </FormField>
            <FormField label="Nombre de colis">
              <Input value={form.nbColis} onChange={set('nbColis')} type="number" />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createBL.isPending}>Créer BL</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
