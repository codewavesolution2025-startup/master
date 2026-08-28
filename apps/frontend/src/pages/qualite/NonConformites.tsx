import { useState } from 'react';
import {
  useNonConformites, useCreateNC, useAnalyserNC,
  usePrendreDecisionNC, useCloturerNC, useStatsNC,
} from '../../hooks/useQualiteExpeditions';
import { useArticles } from '../../hooks/useReferentiels';
import { Table, Badge, Button, Modal, Select, FormField, Input, KpiCard } from '../../components/ui';

const STATUT_VARIANTS: Record<string, any> = {
  OUVERTE: 'danger', EN_ANALYSE: 'warning', EN_ATTENTE_DECISION: 'accent',
  CLOTUREE: 'success',
};

const SEVERITE_VARIANTS: Record<string, any> = {
  CRITIQUE: 'danger', MAJEURE: 'warning', MINEURE: 'neutral',
};

const DECISIONS = [
  { value: 'RETOUR_FOURNISSEUR', label: 'Retour fournisseur' },
  { value: 'DEROGATION', label: 'Dérogation' },
  { value: 'REBUT', label: 'Rebut' },
  { value: 'RETOUCHE', label: 'Retouche' },
  { value: 'ACCEPTATION', label: 'Acceptation' },
];

export default function NonConformitesPage() {
  const [statutFilter, setStatutFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showDecision, setShowDecision] = useState<any>(null);
  const [showCloturer, setShowCloturer] = useState<any>(null);

  const [form, setForm] = useState({
    typeDetection: 'RECEPTION', articleId: '', severite: 'MAJEURE', description: '',
  });
  const [decForm, setDecForm] = useState({
    decision: '', actionCorrective: '', responsableAc: '', delaiAc: '', commentaire: '',
  });

  const { data: ncs, isLoading } = useNonConformites({ statut: statutFilter || undefined });
  useStatsNC();
  const { data: articlesData } = useArticles({ limit: 200 });
  const createNC = useCreateNC();
  const analyser = useAnalyserNC();
  const prendreDecision = usePrendreDecisionNC();
  const cloturer = useCloturerNC();

  const articleOptions = (articlesData?.data || []).map((a: any) => ({
    value: a.id, label: `${a.reference} — ${a.designation}`,
  }));

  const nbOuvertes = (ncs?.data || ncs || []).filter((nc: any) => nc.statut === 'OUVERTE').length;
  const nbAnalyse = (ncs?.data || ncs || []).filter((nc: any) => nc.statut === 'EN_ANALYSE').length;
  const ncList = ncs?.data || ncs || [];

  const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const setDec = (k: string) => (v: string) => setDecForm((f: any) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    try {
      await createNC.mutateAsync(form);
      setShowCreate(false);
      setForm({ typeDetection: 'RECEPTION', articleId: '', severite: 'MAJEURE', description: '' });
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleDecision = async () => {
    try {
      await prendreDecision.mutateAsync({ id: showDecision.id, data: decForm });
      setShowDecision(null);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleCloturer = async () => {
    try {
      await cloturer.mutateAsync({ id: showCloturer.id, data: { efficaciteVerifiee: true } });
      setShowCloturer(null);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Non-conformités</h1>
          <p className="page-subtitle">{ncList.length} NC</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Ouvrir NC</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <KpiCard label="Ouvertes" value={nbOuvertes} variant={nbOuvertes === 0 ? 'success' : 'danger'} icon="🔴" />
        <KpiCard label="En analyse" value={nbAnalyse} variant={nbAnalyse === 0 ? 'success' : 'warning'} icon="🔍" />
        <KpiCard label="Total" value={ncList.length} variant="neutral" icon="📋" />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Select value={statutFilter} onChange={setStatutFilter}
          options={[
            { value: 'OUVERTE', label: 'Ouvertes' },
            { value: 'EN_ANALYSE', label: 'En analyse' },
            { value: 'EN_ATTENTE_DECISION', label: 'En attente décision' },
            { value: 'CLOTUREE', label: 'Clôturées' },
          ]}
          placeholder="Tous les statuts" />
      </div>

      <Table
        loading={isLoading}
        data={ncList}
        emptyText="Aucune non-conformité"
        columns={[
          { key: 'reference', header: 'Référence', width: '140px',
            render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.reference}</span> },
          { key: 'article', header: 'Article',
            render: (r: any) => <span style={{ color: '#C4DCF0' }}>{r.article?.reference}</span> },
          { key: 'severite', header: 'Sévérité', width: '100px',
            render: (r: any) => <Badge variant={SEVERITE_VARIANTS[r.severite]}>{r.severite}</Badge> },
          { key: 'typeDetection', header: 'Type', width: '100px',
            render: (r: any) => <Badge variant="neutral">{r.typeDetection}</Badge> },
          { key: 'statut', header: 'Statut', width: '160px',
            render: (r: any) => <Badge variant={STATUT_VARIANTS[r.statut]}>{r.statut.replace(/_/g, ' ')}</Badge> },
          { key: 'createdAt', header: 'Date', width: '110px',
            render: (r: any) => <span style={{ color: '#3A6278', fontSize: '0.8rem' }}>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</span> },
          { key: 'actions', header: '', width: '200px',
            render: (r: any) => (
              <div style={{ display: 'flex', gap: '4px' }}>
                {r.statut === 'OUVERTE' && (
                  <Button size="sm" variant="secondary" onClick={() => analyser.mutateAsync(r.id)}>Analyser</Button>
                )}
                {['OUVERTE', 'EN_ANALYSE'].includes(r.statut) && (
                  <Button size="sm" variant="secondary" onClick={() => setShowDecision(r)}>Décision</Button>
                )}
                {r.statut === 'EN_ATTENTE_DECISION' && (
                  <Button size="sm" variant="secondary" onClick={() => setShowCloturer(r)}>Clôturer</Button>
                )}
              </div>
            )},
        ]}
      />

      {/* Modal création NC */}
      {showCreate && (
        <Modal title="Ouvrir une non-conformité" onClose={() => setShowCreate(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Type de détection" required>
              <Select value={form.typeDetection} onChange={set('typeDetection')} options={[
                { value: 'RECEPTION', label: 'Réception' },
                { value: 'PRODUCTION', label: 'Production' },
                { value: 'CLIENT', label: 'Client' },
              ]} />
            </FormField>
            <FormField label="Sévérité" required>
              <Select value={form.severite} onChange={set('severite')} options={[
                { value: 'CRITIQUE', label: 'Critique' },
                { value: 'MAJEURE', label: 'Majeure' },
                { value: 'MINEURE', label: 'Mineure' },
              ]} />
            </FormField>
          </div>
          <FormField label="Article" required>
            <Select value={form.articleId} onChange={set('articleId')} options={articleOptions} placeholder="Sélectionner..." />
          </FormField>
          <FormField label="Description" required>
            <Input value={form.description} onChange={set('description')} placeholder="Description du défaut..." />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createNC.isPending}>Ouvrir NC</Button>
          </div>
        </Modal>
      )}

      {/* Modal décision */}
      {showDecision && (
        <Modal title={`Décision — ${showDecision.reference}`} onClose={() => setShowDecision(null)} width="580px">
          <FormField label="Décision" required>
            <Select value={decForm.decision} onChange={setDec('decision')} options={DECISIONS} placeholder="Sélectionner..." />
          </FormField>
          <FormField label="Action corrective" required>
            <Input value={decForm.actionCorrective} onChange={setDec('actionCorrective')} placeholder="Action à mener..." />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Date limite">
              <Input value={decForm.delaiAc} onChange={setDec('delaiAc')} type="date" />
            </FormField>
          </div>
          <FormField label="Commentaire">
            <Input value={decForm.commentaire} onChange={setDec('commentaire')} />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowDecision(null)}>Annuler</Button>
            <Button onClick={handleDecision}>Valider décision</Button>
          </div>
        </Modal>
      )}

      {/* Modal clôture */}
      {showCloturer && (
        <Modal title={`Clôturer — ${showCloturer.reference}`} onClose={() => setShowCloturer(null)}>
          <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
            <span style={{ color: '#4ADE80', fontSize: '0.875rem' }}>✅ Confirmer que l'efficacité de l'action corrective a été vérifiée</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCloturer(null)}>Annuler</Button>
            <Button onClick={handleCloturer}>Confirmer et clôturer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
