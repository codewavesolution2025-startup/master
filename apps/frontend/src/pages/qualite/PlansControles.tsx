import { useState } from 'react';
import {
  usePlansControle, useCreatePlanControle, useAddCritere,
  useControlesReception, useCreateControle, useAddMesure, useFinaliserControle,
} from '../../hooks/useQualiteExpeditions';
import { useArticles } from '../../hooks/useReferentiels';
import { Table, Badge, Button, Modal, Select, FormField, Input } from '../../components/ui';

// ── Plans de contrôle ─────────────────────────────────────────────────────────
export function PlansControlePage() {
  const [articleId, setArticleId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showCritere, setShowCritere] = useState<string | null>(null);
  const [form, setForm] = useState({ articleId: '', niveau: 'NORMAL', frequencePct: '100', tailleEchantillon: '5' });
  const [critForm, setCritForm] = useState({ libelle: '', typeMesure: 'DIMENSIONNEL', valeurNominale: '', tolerancePlus: '', toleranceMoins: '', unite: '', methode: '' });

  const { data: plans, isLoading } = usePlansControle(articleId || undefined);
  const { data: articlesData } = useArticles({ limit: 200 });
  const createPlan = useCreatePlanControle();
  const addCritere = useAddCritere(showCritere || '');

  const articleOptions = (articlesData?.data || []).map((a: any) => ({ value: a.id, label: `${a.reference} — ${a.designation}` }));
  const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const setCrit = (k: string) => (v: string) => setCritForm((f: any) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    try {
      await createPlan.mutateAsync({
        ...form,
        frequencePct: Number(form.frequencePct),
        tailleEchantillon: Number(form.tailleEchantillon),
        articleId: form.articleId || articleId,
      });
      setShowCreate(false);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleAddCritere = async () => {
    try {
      await addCritere.mutateAsync({
        ...critForm,
        valeurNominale: critForm.valeurNominale ? Number(critForm.valeurNominale) : undefined,
        tolerancePlus: critForm.tolerancePlus ? Number(critForm.tolerancePlus) : undefined,
        toleranceMoins: critForm.toleranceMoins ? Number(critForm.toleranceMoins) : undefined,
      });
      setShowCritere(null);
      setCritForm({ libelle: '', typeMesure: 'DIMENSIONNEL', valeurNominale: '', tolerancePlus: '', toleranceMoins: '', unite: '', methode: '' });
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const NIVEAU_VARIANTS: Record<string, any> = { REDUIT: 'success', NORMAL: 'info', RENFORCE: 'warning', RENFORCE_LABO: 'danger' };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Plans de contrôle</h1>
          <p className="page-subtitle">Critères qualité par article</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nouveau plan</Button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Select value={articleId} onChange={setArticleId} options={articleOptions} placeholder="Filtrer par article..." />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isLoading && <div style={{ color: '#3A6278', textAlign: 'center', padding: '40px' }}>Chargement...</div>}
        {(Array.isArray(plans) ? plans : []).map((plan: any) => (
          <div key={plan.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(79,195,247,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Header plan */}
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(79,195,247,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#4FC3F7', fontWeight: 600 }}>{plan.article?.reference}</span>
                <span style={{ color: '#5A7A90' }}>{plan.article?.designation}</span>
                <Badge variant={NIVEAU_VARIANTS[plan.niveau] || 'neutral'}>{plan.niveau}</Badge>
                <span style={{ color: '#3A6278', fontSize: '0.8rem' }}>Fréq: {plan.frequencePct}% · Éch: {plan.tailleEchantillon} pces</span>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowCritere(plan.id)}>+ Critère</Button>
            </div>
            {/* Critères */}
            <div style={{ padding: '12px 20px' }}>
              {(plan.criteres || []).length === 0 ? (
                <span style={{ color: '#2D4A5E', fontSize: '0.82rem' }}>Aucun critère — ajoutez des critères de mesure</span>
              ) : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(plan.criteres || []).map((c: any) => (
                    <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 12px' }}>
                      <div style={{ color: '#C4DCF0', fontWeight: 600, fontSize: '0.82rem' }}>{c.libelle}</div>
                      <div style={{ color: '#3A6278', fontSize: '0.75rem' }}>
                        {c.valeurNominale !== null ? `${c.valeurNominale} ±${c.tolerancePlus || 0}/${c.toleranceMoins || 0} ${c.unite || ''}` : c.typeMesure}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {!isLoading && (Array.isArray(plans) ? plans : []).length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '150px', color: '#2D4A5E' }}>
            Aucun plan de contrôle — créez-en un
          </div>
        )}
      </div>

      {/* Modal création plan */}
      {showCreate && (
        <Modal title="Nouveau plan de contrôle" onClose={() => setShowCreate(false)}>
          <FormField label="Article" required>
            <Select value={form.articleId || articleId} onChange={set('articleId')} options={articleOptions} placeholder="Sélectionner..." />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Niveau de contrôle">
              <Select value={form.niveau} onChange={set('niveau')} options={[
                { value: 'REDUIT', label: 'Réduit' },
                { value: 'NORMAL', label: 'Normal' },
                { value: 'RENFORCE', label: 'Renforcé' },
                { value: 'RENFORCE_LABO', label: 'Renforcé Labo' },
              ]} />
            </FormField>
            <FormField label="Fréquence (%)">
              <Input value={form.frequencePct} onChange={set('frequencePct')} type="number" placeholder="100" />
            </FormField>
            <FormField label="Taille échantillon">
              <Input value={form.tailleEchantillon} onChange={set('tailleEchantillon')} type="number" placeholder="5" />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createPlan.isPending}>Créer</Button>
          </div>
        </Modal>
      )}

      {/* Modal ajout critère */}
      {showCritere && (
        <Modal title="Ajouter un critère" onClose={() => setShowCritere(null)}>
          <FormField label="Libellé" required>
            <Input value={critForm.libelle} onChange={setCrit('libelle')} placeholder="Diamètre extérieur, Masse, Aspect visuel..." />
          </FormField>
          <FormField label="Type de mesure">
            <Select value={critForm.typeMesure} onChange={setCrit('typeMesure')} options={[
              { value: 'VISUEL', label: 'Visuel' },
              { value: 'DIMENSIONNEL', label: 'Dimensionnel' },
              { value: 'MASSE', label: 'Masse' },
              { value: 'CHIMIQUE', label: 'Chimique' },
            ]} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
            <FormField label="Valeur nominale">
              <Input value={critForm.valeurNominale} onChange={setCrit('valeurNominale')} type="number" placeholder="10.0" />
            </FormField>
            <FormField label="Tol. + ">
              <Input value={critForm.tolerancePlus} onChange={setCrit('tolerancePlus')} type="number" placeholder="0.1" />
            </FormField>
            <FormField label="Tol. -">
              <Input value={critForm.toleranceMoins} onChange={setCrit('toleranceMoins')} type="number" placeholder="0.1" />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Unité">
              <Input value={critForm.unite} onChange={setCrit('unite')} placeholder="mm, kg, °C..." />
            </FormField>
            <FormField label="Méthode">
              <Input value={critForm.methode} onChange={setCrit('methode')} placeholder="Pied à coulisse..." />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCritere(null)}>Annuler</Button>
            <Button onClick={handleAddCritere} disabled={addCritere.isPending}>Ajouter</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Contrôles réception ───────────────────────────────────────────────────────
export function ControlesReceptionPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [mesureForm, setMesureForm] = useState({ critereId: '', valeurMesuree: '' });
  const [form, setForm] = useState({ receptionId: '', lotId: '', planId: '' });

  const { data: controles, isLoading } = useControlesReception();
  const { data: plans } = usePlansControle();
  const createControle = useCreateControle();
  const addMesure = useAddMesure(detailId || '');
  const finaliser = useFinaliserControle();

  const controleList = Array.isArray(controles) ? controles : [];
  const planOptions = (Array.isArray(plans) ? plans : []).map((p: any) => ({
    value: p.id, label: `${p.article?.reference} — Niveau ${p.niveau}`,
  }));

  const detailControle = controleList.find((c: any) => c.id === detailId);
  const critereOptions = (detailControle?.plan?.criteres || []).map((c: any) => ({
    value: c.id, label: c.libelle,
  }));

  const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    try {
      await createControle.mutateAsync(form);
      setShowCreate(false);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleAddMesure = async () => {
    try {
      await addMesure.mutateAsync({
        critereId: mesureForm.critereId,
        valeurMesuree: mesureForm.valeurMesuree ? Number(mesureForm.valeurMesuree) : undefined,
      });
      setMesureForm({ critereId: '', valeurMesuree: '' });
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contrôles réception</h1>
          <p className="page-subtitle">Mesures et décisions OK/NOK</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nouveau contrôle</Button>
      </div>

      <Table
        loading={isLoading}
        data={controleList}
        emptyText="Aucun contrôle réception"
        onRowClick={(r: any) => setDetailId(r.id)}
        columns={[
          { key: 'lot', header: 'Lot', width: '160px',
            render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.lot?.numero}</span> },
          { key: 'plan', header: 'Plan de contrôle',
            render: (r: any) => <span style={{ color: '#C4DCF0' }}>{r.plan?.article?.reference} — Niveau {r.plan?.niveau}</span> },
          { key: 'resultat', header: 'Résultat', width: '100px',
            render: (r: any) => <Badge variant={r.resultat === 'OK' ? 'success' : r.resultat === 'NOK' ? 'danger' : 'warning'}>
              {r.resultat || 'ENCOURS'}
            </Badge> },
          { key: 'mesures', header: 'Mesures', width: '80px',
            render: (r: any) => <span style={{ color: '#5A7A90' }}>{(r.mesures || []).length}</span> },
          { key: 'dateControle', header: 'Date', width: '110px',
            render: (r: any) => <span style={{ color: '#3A6278', fontSize: '0.8rem' }}>{new Date(r.dateControle || r.createdAt).toLocaleDateString('fr-FR')}</span> },
          { key: 'actions', header: '', width: '160px',
            render: (r: any) => r.resultat === 'ENCOURS' && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <Button size="sm" variant="secondary" onClick={() => finaliser.mutateAsync({ id: r.id, resultat: 'OK' })}>✓ OK</Button>
                <Button size="sm" variant="danger" onClick={() => finaliser.mutateAsync({ id: r.id, resultat: 'NOK' })}>✗ NOK</Button>
              </div>
            )},
        ]}
      />

      {/* Detail contrôle — saisie mesures */}
      {detailId && detailControle && (
        <Modal title={`Contrôle — ${detailControle.lot?.numero}`} onClose={() => setDetailId(null)} width="650px">
          <div style={{ marginBottom: '16px' }}>
            <Badge variant={detailControle.resultat === 'OK' ? 'success' : detailControle.resultat === 'NOK' ? 'danger' : 'warning'}>
              {detailControle.resultat || 'EN COURS'}
            </Badge>
          </div>

          {/* Mesures existantes */}
          {(detailControle.mesures || []).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: '#5A7A90', fontSize: '0.78rem', textTransform: 'uppercase', marginBottom: '8px' }}>Mesures saisies</h4>
              <Table data={detailControle.mesures || []} emptyText=""
                columns={[
                  { key: 'critere', header: 'Critère', render: (r: any) => <span style={{ color: '#C4DCF0' }}>{r.critere?.libelle || '—'}</span> },
                  { key: 'valeurMesuree', header: 'Valeur', width: '100px', render: (r: any) => <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{r.valeurMesuree ?? '—'}</span> },
                  { key: 'conforme', header: 'Conforme', width: '90px',
                    render: (r: any) => r.conforme === null ? <Badge variant="neutral">—</Badge>
                      : r.conforme ? <Badge variant="success">✓ OK</Badge>
                      : <Badge variant="danger">✗ NOK</Badge> },
                ]}
              />
            </div>
          )}

          {/* Ajout mesure */}
          {detailControle.resultat === 'ENCOURS' && (
            <div style={{ background: 'rgba(79,195,247,0.04)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(79,195,247,0.1)' }}>
              <h4 style={{ color: '#5A7A90', fontSize: '0.78rem', textTransform: 'uppercase', marginBottom: '12px' }}>Saisir une mesure</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                <FormField label="Critère">
                  <Select value={mesureForm.critereId} onChange={v => setMesureForm(f => ({ ...f, critereId: v }))} options={critereOptions} placeholder="Sélectionner..." />
                </FormField>
                <FormField label="Valeur mesurée">
                  <Input value={mesureForm.valeurMesuree} onChange={v => setMesureForm(f => ({ ...f, valeurMesuree: v }))} type="number" />
                </FormField>
                <Button onClick={handleAddMesure} disabled={!mesureForm.critereId}>+</Button>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <Button variant="secondary" onClick={() => finaliser.mutateAsync({ id: detailId, resultat: 'OK' })}>✓ Valider OK</Button>
                <Button variant="danger" onClick={() => finaliser.mutateAsync({ id: detailId, resultat: 'NOK' })}>✗ Rejeter NOK</Button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Button variant="ghost" onClick={() => setDetailId(null)}>Fermer</Button>
          </div>
        </Modal>
      )}

      {/* Modal création contrôle */}
      {showCreate && (
        <Modal title="Nouveau contrôle réception" onClose={() => setShowCreate(false)}>
          <FormField label="Plan de contrôle" required>
            <Select value={form.planId} onChange={set('planId')} options={planOptions} placeholder="Sélectionner un plan..." />
          </FormField>
          <FormField label="ID Réception">
            <Input value={form.receptionId} onChange={set('receptionId')} placeholder="UUID de la réception..." />
          </FormField>
          <FormField label="ID Lot">
            <Input value={form.lotId} onChange={set('lotId')} placeholder="UUID du lot à contrôler..." />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createControle.isPending}>Créer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
