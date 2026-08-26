import { useState } from 'react';
import {
  useMouvements, useCreateMouvement,
  useInventaires, useCreateInventaire, useAddLigneInventaire, useValiderInventaire, useEcartsInventaire,
} from '../../hooks/useStock';
import { useSites, useArticles } from '../../hooks/useReferentiels';
import { Table, Badge, Button, Modal, Select, FormField, Input } from '../../components/ui';

const TYPES_MOUVEMENT = [
  { value: 'ENTREE_RECEPTION', label: 'Entrée réception' },
  { value: 'ENTREE_PRODUCTION', label: 'Entrée production' },
  { value: 'ENTREE_AJUSTEMENT', label: 'Entrée ajustement' },
  { value: 'SORTIE_CONSOMMATION', label: 'Sortie consommation' },
  { value: 'SORTIE_EXPEDITION', label: 'Sortie expédition' },
  { value: 'SORTIE_AJUSTEMENT', label: 'Sortie ajustement' },
  { value: 'SORTIE_REBUT', label: 'Sortie rebut' },
  { value: 'TRANSFERT_INTERNE', label: 'Transfert interne' },
];

// ── Page Mouvements ───────────────────────────────────────────────────────────
export function MouvementsPage() {
  const [page, setPage] = useState(1);
  const [siteId, setSiteId] = useState('');
  const [typeMouvement, setTypeMouvement] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ articleId: '', siteId: '', typeMouvement: 'ENTREE_RECEPTION', quantite: '', sens: '1', commentaire: '' });

  const { data, isLoading } = useMouvements({ siteId: siteId || undefined, typeMouvement: typeMouvement || undefined, page, limit: 50 });
  const { data: sites } = useSites();
  const { data: articlesData } = useArticles({ limit: 100 });
  const createMouvement = useCreateMouvement();

  const mouvements = data?.data || [];
  const siteOptions = (sites || []).map((s: any) => ({ value: s.id, label: `${s.code} — ${s.nom}` }));
  const articleOptions = (articlesData?.data || []).map((a: any) => ({ value: a.id, label: `${a.reference} — ${a.designation}` }));
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    try {
      await createMouvement.mutateAsync({
        ...form,
        quantite: Number(form.quantite),
        sens: Number(form.sens),
      });
      setShowCreate(false);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mouvements de stock</h1>
          <p className="page-subtitle">Historique complet des entrées et sorties</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Mouvement manuel</Button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Select value={siteId} onChange={setSiteId} options={siteOptions} placeholder="Tous les sites" />
        <Select value={typeMouvement} onChange={setTypeMouvement} options={TYPES_MOUVEMENT} placeholder="Tous les types" />
      </div>

      <Table
        loading={isLoading}
        data={mouvements}
        emptyText="Aucun mouvement"
        columns={[
          { key: 'createdAt', header: 'Date', width: '140px',
            render: r => <span style={{ color: '#5A7A90', fontSize: '0.8rem' }}>{new Date(r.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> },
          { key: 'article', header: 'Article',
            render: r => (
              <div>
                <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.8rem' }}>{r.article?.reference}</span>
                <span style={{ color: '#5A7A90', marginLeft: '8px', fontSize: '0.78rem' }}>{r.article?.designation}</span>
              </div>
            )},
          { key: 'typeMouvement', header: 'Type', width: '180px',
            render: r => <span style={{ color: '#C4DCF0', fontSize: '0.82rem' }}>{r.typeMouvement?.replace(/_/g, ' ')}</span> },
          { key: 'sens', header: 'Sens', width: '70px',
            render: r => r.sens === 1
              ? <Badge variant="success">▲ Entrée</Badge>
              : <Badge variant="danger">▼ Sortie</Badge> },
          { key: 'quantite', header: 'Quantité', width: '100px',
            render: r => <span style={{ color: r.sens === 1 ? '#4ADE80' : '#FCA5A5', fontWeight: 700 }}>
              {r.sens === 1 ? '+' : '-'}{Number(r.quantite).toFixed(2)}
            </span> },
          { key: 'lot', header: 'Lot', width: '150px',
            render: r => r.lot ? <span style={{ fontFamily: 'monospace', color: '#5A7A90', fontSize: '0.75rem' }}>{r.lot.numero}</span> : '—' },
          { key: 'origineType', header: 'Origine', width: '120px',
            render: r => r.origineType ? <Badge variant="neutral">{r.origineType}</Badge> : '—' },
        ]}
      />

      {showCreate && (
        <Modal title="Mouvement manuel" onClose={() => setShowCreate(false)}>
          <FormField label="Article" required>
            <Select value={form.articleId} onChange={set('articleId')} options={articleOptions} placeholder="Sélectionner..." />
          </FormField>
          <FormField label="Site" required>
            <Select value={form.siteId} onChange={set('siteId')} options={siteOptions} placeholder="Sélectionner..." />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Type de mouvement" required>
              <Select value={form.typeMouvement} onChange={set('typeMouvement')} options={TYPES_MOUVEMENT} />
            </FormField>
            <FormField label="Sens" required>
              <Select value={form.sens} onChange={set('sens')} options={[
                { value: '1', label: '▲ Entrée (+1)' },
                { value: '-1', label: '▼ Sortie (-1)' },
              ]} />
            </FormField>
            <FormField label="Quantité" required>
              <Input value={form.quantite} onChange={set('quantite')} type="number" placeholder="0" />
            </FormField>
          </div>
          <FormField label="Commentaire">
            <Input value={form.commentaire} onChange={set('commentaire')} placeholder="Motif du mouvement..." />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createMouvement.isPending}>Créer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Page Inventaires ──────────────────────────────────────────────────────────
export function InventairesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ siteId: '', commentaire: '' });
  const [ligneForm, setLigneForm] = useState({ articleId: '', qteConstatee: '' });

  const { data: inventaires, isLoading } = useInventaires();
  const { data: ecarts } = useEcartsInventaire(selectedId || '');
  const { data: sites } = useSites();
  const { data: articlesData } = useArticles({ limit: 100 });
  const createInv = useCreateInventaire();
  const addLigne = useAddLigneInventaire(selectedId || '');
  const valider = useValiderInventaire();

  const siteOptions = (sites || []).map((s: any) => ({ value: s.id, label: `${s.code} — ${s.nom}` }));
  const articleOptions = (articlesData?.data || []).map((a: any) => ({ value: a.id, label: `${a.reference} — ${a.designation}` }));

  const handleCreateInv = async () => {
    try {
      await createInv.mutateAsync(form);
      setShowCreate(false);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleAddLigne = async () => {
    try {
      await addLigne.mutateAsync({ articleId: ligneForm.articleId, qteConstatee: Number(ligneForm.qteConstatee) });
      setLigneForm({ articleId: '', qteConstatee: '' });
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleValider = async () => {
    if (!selectedId) return;
    if (!confirm('Valider l\'inventaire ? Les ajustements de stock seront créés.')) return;
    try {
      await valider.mutateAsync({ id: selectedId });
      setSelectedId(null);
      alert('Inventaire validé — ajustements créés');
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventaires physiques</h1>
          <p className="page-subtitle">Sessions de comptage et validation</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nouvelle session</Button>
      </div>

      <Table
        loading={isLoading}
        data={inventaires || []}
        emptyText="Aucun inventaire"
        onRowClick={r => r.statut === 'EN_COURS' && setSelectedId(r.id)}
        columns={[
          { key: 'date_inventaire', header: 'Date', width: '140px',
            render: r => <span style={{ color: '#5A7A90', fontSize: '0.82rem' }}>{new Date(r.date_inventaire).toLocaleDateString('fr-FR')}</span> },
          { key: 'site_nom', header: 'Site', render: r => `${r.site_code} — ${r.site_nom}` },
          { key: 'statut', header: 'Statut', width: '100px',
            render: r => <Badge variant={r.statut === 'VALIDE' ? 'success' : r.statut === 'EN_COURS' ? 'warning' : 'neutral'}>{r.statut}</Badge> },
          { key: 'nb_lignes', header: 'Lignes', width: '80px',
            render: r => <span style={{ color: '#5A7A90' }}>{r.nb_lignes}</span> },
          { key: 'actions', header: '', width: '100px',
            render: r => r.statut === 'EN_COURS' && (
              <Button size="sm" variant="secondary" onClick={() => setSelectedId(r.id)}>Saisir</Button>
            )},
        ]}
      />

      {/* Modal session inventaire */}
      {selectedId && (
        <Modal title="Session d'inventaire" onClose={() => setSelectedId(null)} width="700px">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'end' }}>
              <FormField label="Article">
                <Select value={ligneForm.articleId} onChange={v => setLigneForm(f => ({ ...f, articleId: v }))}
                  options={articleOptions} placeholder="Sélectionner un article" />
              </FormField>
              <FormField label="Qté constatée">
                <Input value={ligneForm.qteConstatee} onChange={v => setLigneForm(f => ({ ...f, qteConstatee: v }))} type="number" placeholder="0" />
              </FormField>
              <Button onClick={handleAddLigne} disabled={!ligneForm.articleId || addLigne.isPending}>Ajouter</Button>
            </div>
          </div>

          {/* Écarts */}
          {(ecarts || []).length > 0 && (
            <>
              <h4 style={{ color: '#5A7A90', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Écarts constatés</h4>
              <Table
                data={ecarts || []}
                columns={[
                  { key: 'reference', header: 'Référence', width: '120px',
                    render: r => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.8rem' }}>{r.reference}</span> },
                  { key: 'designation', header: 'Article' },
                  { key: 'qte_theorique', header: 'Théorique', width: '90px',
                    render: r => <span style={{ color: '#5A7A90' }}>{Number(r.qte_theorique).toFixed(2)}</span> },
                  { key: 'qte_constatee', header: 'Constaté', width: '90px',
                    render: r => <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{Number(r.qte_constatee).toFixed(2)}</span> },
                  { key: 'ecart', header: 'Écart', width: '90px',
                    render: r => {
                      const e = Number(r.ecart);
                      return <span style={{ color: e > 0 ? '#4ADE80' : e < 0 ? '#FCA5A5' : '#5A7A90', fontWeight: 700 }}>
                        {e > 0 ? '+' : ''}{e.toFixed(2)}
                      </span>;
                    }},
                  { key: 'statut_ligne', header: 'Statut', width: '130px',
                    render: r => <Badge variant={r.statut_ligne === 'VALIDATION_REQUISE' ? 'warning' : 'success'}>{r.statut_ligne}</Badge> },
                ]}
              />
            </>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Button variant="ghost" onClick={() => setSelectedId(null)}>Fermer</Button>
            <Button onClick={handleValider} disabled={valider.isPending}>
              ✓ Valider l'inventaire
            </Button>
          </div>
        </Modal>
      )}

      {/* Modal création */}
      {showCreate && (
        <Modal title="Nouvelle session d'inventaire" onClose={() => setShowCreate(false)}>
          <FormField label="Site" required>
            <Select value={form.siteId} onChange={v => setForm(f => ({ ...f, siteId: v }))} options={siteOptions} placeholder="Sélectionner un site" />
          </FormField>
          <FormField label="Commentaire">
            <Input value={form.commentaire} onChange={v => setForm(f => ({ ...f, commentaire: v }))} placeholder="Inventaire trimestriel..." />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreateInv} disabled={!form.siteId || createInv.isPending}>Créer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
