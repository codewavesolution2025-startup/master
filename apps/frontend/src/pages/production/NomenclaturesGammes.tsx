import { useState } from 'react';
import {
  useNomenclature, useCreateNomenclature, useDesactiverNomenclature,
  useBesoinsNomenclature, useGammes, useGamme, useCreateGamme, useAddOperation,
} from '../../hooks/useProduction';
import { useArticles, usePostesCharge } from '../../hooks/useReferentiels';
import { Table, Badge, Button, Modal, Select, FormField, Input } from '../../components/ui';

// ── Page Nomenclatures ────────────────────────────────────────────────────────
export function NomenclaturesPage() {
  const [articleId, setArticleId] = useState('');
  const [quantite, setQuantite] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    articleParent: '', composantId: '', quantite: '', unite: '', tauxPertePct: '0',
  });

  const { data: articlesData } = useArticles({ limit: 200 });
  const { data: nomenclature, isLoading } = useNomenclature(articleId, 5);
  const { data: besoins } = useBesoinsNomenclature(articleId, quantite);
  const createNom = useCreateNomenclature();
  const desactiver = useDesactiverNomenclature();

  const articleOptions = (articlesData?.data || []).map((a: any) => ({
    value: a.id, label: `${a.reference} — ${a.designation}`,
  }));
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    try {
      await createNom.mutateAsync({
        ...form,
        quantite: Number(form.quantite),
        tauxPertePct: Number(form.tauxPertePct),
        articleParent: form.articleParent || articleId,
      });
      setShowCreate(false);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const nomList = Array.isArray(nomenclature) ? nomenclature : [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nomenclatures BOM</h1>
          <p className="page-subtitle">Arbre des composants multi-niveaux</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Ajouter composant</Button>
      </div>

      {/* Sélecteur article */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <FormField label="Article (produit fini ou semi-fini)">
            <Select value={articleId} onChange={setArticleId} options={articleOptions} placeholder="Sélectionner un article..." />
          </FormField>
        </div>
        {articleId && (
          <div style={{ width: '140px' }}>
            <FormField label="Quantité OF">
              <Input value={quantite} onChange={v => setQuantite(Number(v))} type="number" />
            </FormField>
          </div>
        )}
      </div>

      {articleId && (
        <>
          {/* Besoins calculés */}
          {besoins && (
            <div style={{
              background: besoins.estFaisable ? 'rgba(74,222,128,0.05)' : 'rgba(239,68,68,0.05)',
              border: `1px solid ${besoins.estFaisable ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
              borderRadius: '10px', padding: '12px 16px', marginBottom: '16px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ fontSize: '1.2rem' }}>{besoins.estFaisable ? '✅' : '⚠️'}</span>
              <span style={{ color: besoins.estFaisable ? '#4ADE80' : '#FCA5A5', fontWeight: 600 }}>
                {besoins.estFaisable
                  ? `Production de ${quantite} unités faisable — tous les composants disponibles`
                  : `${besoins.composants?.filter((c: any) => parseFloat(c.manquant) > 0).length} composant(s) manquant(s) pour ${quantite} unités`}
              </span>
            </div>
          )}

          {/* Arbre BOM */}
          <Table
            loading={isLoading}
            data={nomList}
            emptyText="Aucun composant — ajoutez des lignes à cette nomenclature"
            columns={[
              { key: 'profondeur', header: 'Niv.', width: '50px',
                render: (r: any) => <span style={{ color: '#3A6278', fontWeight: 700 }}>{r.profondeur || 1}</span> },
              { key: 'composant_ref', header: 'Référence', width: '140px',
                render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem', paddingLeft: `${(r.profondeur || 0) * 12}px` }}>
                  {r.composant_ref || r.composant?.reference}
                </span> },
              { key: 'composant_nom', header: 'Désignation',
                render: (r: any) => <span style={{ color: '#C4DCF0' }}>{r.composant_nom || r.composant?.designation}</span> },
              { key: 'article_type', header: 'Type', width: '90px',
                render: (r: any) => <Badge variant={r.article_type === 'MP' ? 'info' : 'accent'}>{r.article_type || r.composant?.type}</Badge> },
              { key: 'quantite', header: 'Quantité', width: '90px',
                render: (r: any) => <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{Number(r.quantite).toFixed(3)}</span> },
              { key: 'taux_perte_pct', header: 'Perte %', width: '80px',
                render: (r: any) => <span style={{ color: '#5A7A90' }}>{Number(r.taux_perte_pct || 0).toFixed(1)}%</span> },
              { key: 'qte_avec_perte', header: 'Qté + perte', width: '100px',
                render: (r: any) => <span style={{ color: '#FCD34D', fontWeight: 600 }}>{Number(r.qte_avec_perte).toFixed(3)}</span> },
              { key: 'actions', header: '', width: '90px',
                render: (r: any) => r.id && (
                  <Button size="sm" variant="danger" onClick={() => desactiver.mutateAsync(r.id)}>Désact.</Button>
                )},
            ]}
          />
        </>
      )}

      {!articleId && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: '#2D4A5E' }}>
          Sélectionnez un article pour voir sa nomenclature
        </div>
      )}

      {showCreate && (
        <Modal title="Ajouter un composant" onClose={() => setShowCreate(false)}>
          <FormField label="Article parent">
            <Select value={form.articleParent || articleId} onChange={set('articleParent')}
              options={articleOptions} placeholder="Article parent..." />
          </FormField>
          <FormField label="Composant" required>
            <Select value={form.composantId} onChange={set('composantId')} options={articleOptions} placeholder="Composant à ajouter..." />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Quantité" required>
              <Input value={form.quantite} onChange={set('quantite')} type="number" placeholder="1.0" />
            </FormField>
            <FormField label="Unité">
              <Input value={form.unite} onChange={set('unite')} placeholder="kg, m, pce..." />
            </FormField>
            <FormField label="Taux de perte (%)">
              <Input value={form.tauxPertePct} onChange={set('tauxPertePct')} type="number" placeholder="0" />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createNom.isPending}>Ajouter</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Page Gammes ───────────────────────────────────────────────────────────────
export function GammesPage() {
  const [articleId, setArticleId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showAddOp, setShowAddOp] = useState(false);
  const [form, setForm] = useState({ articleId: '', code: '', version: '1.0', notes: '' });
  const [opForm, setOpForm] = useState({ numeroOp: '10', libelle: '', posteChargeId: '', tempsPreparation: '0', tempsUnitaire: '0', tempsNettoyage: '0', nbOperateurs: '1', pointDeControle: false });

  const { data: articlesData } = useArticles({ limit: 200 });
  const { data: gammes, isLoading } = useGammes(articleId || undefined);
  const { data: gammeDetail } = useGamme(detailId || '');
  const { data: postes } = usePostesCharge();
  const createGamme = useCreateGamme();
  const addOp = useAddOperation(detailId || '');

  const articleOptions = (articlesData?.data || []).map((a: any) => ({ value: a.id, label: `${a.reference} — ${a.designation}` }));
  const posteOptions = (postes || []).map((p: any) => ({ value: p.id, label: `${p.code} — ${p.libelle}` }));
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const setOp = (k: string) => (v: string) => setOpForm(f => ({ ...f, [k]: v }));

  const handleCreateGamme = async () => {
    try {
      await createGamme.mutateAsync({ ...form, articleId: form.articleId || articleId });
      setShowCreate(false);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleAddOp = async () => {
    try {
      await addOp.mutateAsync({
        ...opForm,
        numeroOp: Number(opForm.numeroOp),
        tempsPreparation: Number(opForm.tempsPreparation),
        tempsUnitaire: Number(opForm.tempsUnitaire),
        tempsNettoyage: Number(opForm.tempsNettoyage),
        nbOperateurs: Number(opForm.nbOperateurs),
      });
      setShowAddOp(false);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gammes opératoires</h1>
          <p className="page-subtitle">Séquences d'opérations par article</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nouvelle gamme</Button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Select value={articleId} onChange={setArticleId} options={articleOptions} placeholder="Filtrer par article..." />
      </div>

      <Table
        loading={isLoading}
        data={Array.isArray(gammes) ? gammes : []}
        emptyText="Aucune gamme"
        onRowClick={r => setDetailId(r.id)}
        columns={[
          { key: 'code', header: 'Code', width: '140px',
            render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.code}</span> },
          { key: 'article', header: 'Article',
            render: (r: any) => <span style={{ color: '#C4DCF0' }}>{r.article?.reference} — {r.article?.designation}</span> },
          { key: 'version', header: 'Version', width: '80px',
            render: (r: any) => <Badge variant="neutral">v{r.version}</Badge> },
          { key: 'statut', header: 'Statut', width: '90px',
            render: (r: any) => <Badge variant={r.statut === 'ACTIF' ? 'success' : r.statut === 'REVISE' ? 'warning' : 'neutral'}>{r.statut}</Badge> },
          { key: 'operations', header: 'Opérations', width: '100px',
            render: (r: any) => <span style={{ color: '#5A7A90' }}>{(r.operations || []).length} ops</span> },
        ]}
      />

      {/* Detail gamme */}
      {detailId && gammeDetail && (
        <Modal title={`${gammeDetail.code} v${gammeDetail.version}`} onClose={() => setDetailId(null)} width="720px">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <Badge variant={gammeDetail.statut === 'ACTIF' ? 'success' : 'neutral'}>{gammeDetail.statut}</Badge>
            {gammeDetail.statut === 'ACTIF' && (
              <Button size="sm" variant="secondary" onClick={() => setShowAddOp(true)}>+ Opération</Button>
            )}
          </div>
          <Table
            data={gammeDetail.operations || []}
            emptyText="Aucune opération"
            columns={[
              { key: 'numeroOp', header: 'N°', width: '50px', render: (r: any) => <span style={{ color: '#4FC3F7', fontWeight: 700 }}>{r.numeroOp}</span> },
              { key: 'libelle', header: 'Opération' },
              { key: 'posteCharge', header: 'Poste', width: '150px', render: (r: any) => <span style={{ color: '#5A7A90', fontSize: '0.82rem' }}>{r.posteCharge?.code} — {r.posteCharge?.libelle}</span> },
              { key: 'tempsPreparation', header: 'Prép.', width: '70px', render: (r: any) => <span style={{ color: '#5A7A90' }}>{r.tempsPreparation}min</span> },
              { key: 'tempsUnitaire', header: 'Unit.', width: '70px', render: (r: any) => <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{r.tempsUnitaire}min</span> },
              { key: 'pointDeControle', header: 'Contrôle', width: '80px', render: (r: any) => r.pointDeControle ? <Badge variant="warning">✓</Badge> : '—' },
            ]}
          />

          {showAddOp && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(79,195,247,0.04)', borderRadius: '10px', border: '1px solid rgba(79,195,247,0.1)' }}>
              <h4 style={{ color: '#5A7A90', fontSize: '0.78rem', textTransform: 'uppercase', marginBottom: '12px' }}>Nouvelle opération</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <FormField label="N° opération"><Input value={opForm.numeroOp} onChange={setOp('numeroOp')} type="number" /></FormField>
                <FormField label="Libellé" required><Input value={opForm.libelle} onChange={setOp('libelle')} placeholder="Découpe laser" /></FormField>
                <div style={{ gridColumn: '1/-1' }}>
                  <FormField label="Poste de charge" required>
                    <Select value={opForm.posteChargeId} onChange={setOp('posteChargeId')} options={posteOptions} placeholder="Sélectionner..." />
                  </FormField>
                </div>
                <FormField label="Temps prép. (min)"><Input value={opForm.tempsPreparation} onChange={setOp('tempsPreparation')} type="number" /></FormField>
                <FormField label="Temps unit. (min)"><Input value={opForm.tempsUnitaire} onChange={setOp('tempsUnitaire')} type="number" /></FormField>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button variant="ghost" onClick={() => setShowAddOp(false)}>Annuler</Button>
                <Button onClick={handleAddOp} disabled={addOp.isPending}>Ajouter</Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {showCreate && (
        <Modal title="Nouvelle gamme" onClose={() => setShowCreate(false)}>
          <FormField label="Article" required>
            <Select value={form.articleId || articleId} onChange={set('articleId')} options={articleOptions} placeholder="Sélectionner..." />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Code" required><Input value={form.code} onChange={set('code')} placeholder="GME-001" /></FormField>
            <FormField label="Version"><Input value={form.version} onChange={set('version')} placeholder="1.0" /></FormField>
          </div>
          <FormField label="Notes"><Input value={form.notes} onChange={set('notes')} placeholder="Remarques..." /></FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreateGamme} disabled={createGamme.isPending}>Créer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}