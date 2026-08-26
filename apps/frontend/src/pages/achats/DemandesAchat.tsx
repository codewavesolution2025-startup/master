import { useState } from 'react';
import {
  useDemandesAchat, useCreateDemandeAchat, useValiderDA, useRefuserDA,
} from '../../hooks/useAchats';
import { useArticles, useSites } from '../../hooks/useReferentiels';
import { Table, Badge, Button, Modal, Select, FormField, Input } from '../../components/ui';

const STATUT_VARIANTS: Record<string, any> = {
  EN_ATTENTE: 'warning', VALIDEE: 'success', REFUSEE: 'danger',
};

const ORIGINES = [
  { value: 'MANUELLE', label: 'Manuelle' },
  { value: 'ALERTE_STOCK', label: 'Alerte stock' },
  { value: 'MRP', label: 'MRP' },
];

export default function DemandesAchatPage() {
  const [statutFilter, setStatutFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showRefus, setShowRefus] = useState<any>(null);
  const [form, setForm] = useState({ articleId: '', siteId: '', quantite: '', origine: 'MANUELLE', justification: '' });
  const [commentaireRefus, setCommentaireRefus] = useState('');

  const { data: das, isLoading } = useDemandesAchat({ statut: statutFilter || undefined });
  const { data: articlesData } = useArticles({ limit: 100 });
  const { data: sites } = useSites();
  const createDA = useCreateDemandeAchat();
  const valider = useValiderDA();
  const refuser = useRefuserDA();

  const articleOptions = (articlesData?.data || []).map((a: any) => ({ value: a.id, label: `${a.reference} — ${a.designation}` }));
  const siteOptions = (sites || []).map((s: any) => ({ value: s.id, label: `${s.code} — ${s.nom}` }));
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    try {
      await createDA.mutateAsync({ ...form, quantite: Number(form.quantite) });
      setShowCreate(false);
      setForm({ articleId: '', siteId: '', quantite: '', origine: 'MANUELLE', justification: '' });
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleValider = async (id: string) => {
    if (!confirm('Valider cette demande d\'achat ?')) return;
    try { await valider.mutateAsync(id); } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleRefuser = async () => {
    if (!commentaireRefus.trim()) { alert('Commentaire obligatoire pour un refus'); return; }
    try {
      await refuser.mutateAsync({ id: showRefus.id, commentaire: commentaireRefus });
      setShowRefus(null);
      setCommentaireRefus('');
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Demandes d'achat</h1>
          <p className="page-subtitle">{(das || []).length} demandes</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nouvelle DA</Button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <Select value={statutFilter} onChange={setStatutFilter}
          options={[
            { value: 'EN_ATTENTE', label: 'En attente' },
            { value: 'VALIDEE', label: 'Validées' },
            { value: 'REFUSEE', label: 'Refusées' },
          ]}
          placeholder="Tous les statuts" />
      </div>

      <Table
        loading={isLoading}
        data={das || []}
        emptyText="Aucune demande d'achat"
        columns={[
          { key: 'reference', header: 'Référence', width: '140px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.reference}</span> },
          { key: 'article', header: 'Article',
            render: r => (
              <div>
                <div style={{ color: '#C4DCF0' }}>{r.article?.reference}</div>
                <div style={{ color: '#3A6278', fontSize: '0.75rem' }}>{r.article?.designation}</div>
              </div>
            )},
          { key: 'quantite', header: 'Quantité', width: '100px',
            render: r => <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{Number(r.quantite).toFixed(2)}</span> },
          { key: 'statut', header: 'Statut', width: '110px',
            render: r => <Badge variant={STATUT_VARIANTS[r.statut]}>{r.statut.replace('_', ' ')}</Badge> },
          { key: 'origine', header: 'Origine', width: '110px',
            render: r => <Badge variant="neutral">{r.origine}</Badge> },
          { key: 'createdAt', header: 'Date', width: '110px',
            render: r => <span style={{ color: '#5A7A90', fontSize: '0.8rem' }}>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</span> },
          { key: 'actions', header: '', width: '180px',
            render: r => r.statut === 'EN_ATTENTE' ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <Button size="sm" variant="secondary" onClick={() => handleValider(r.id)}>✓ Valider</Button>
                <Button size="sm" variant="danger" onClick={() => setShowRefus(r)}>✗ Refuser</Button>
              </div>
            ) : null },
        ]}
      />

      {/* Modal création DA */}
      {showCreate && (
        <Modal title="Nouvelle demande d'achat" onClose={() => setShowCreate(false)}>
          <FormField label="Article" required>
            <Select value={form.articleId} onChange={set('articleId')} options={articleOptions} placeholder="Sélectionner un article" />
          </FormField>
          <FormField label="Site" required>
            <Select value={form.siteId} onChange={set('siteId')} options={siteOptions} placeholder="Sélectionner un site" />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Quantité" required>
              <Input value={form.quantite} onChange={set('quantite')} type="number" placeholder="0" />
            </FormField>
            <FormField label="Origine">
              <Select value={form.origine} onChange={set('origine')} options={ORIGINES} />
            </FormField>
          </div>
          <FormField label="Justification">
            <Input value={form.justification} onChange={set('justification')} placeholder="Raison de la demande..." />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createDA.isPending}>Créer</Button>
          </div>
        </Modal>
      )}

      {/* Modal refus */}
      {showRefus && (
        <Modal title={`Refuser DA ${showRefus.reference}`} onClose={() => setShowRefus(null)}>
          <FormField label="Commentaire de refus" required>
            <Input value={commentaireRefus} onChange={setCommentaireRefus} placeholder="Motif du refus (obligatoire)..." />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowRefus(null)}>Annuler</Button>
            <Button variant="danger" onClick={handleRefuser}>Confirmer le refus</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
