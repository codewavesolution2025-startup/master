// ═══════════════════════════════════════════════════════════════════════════
// BARREL — Export de toutes les entities TypeORM
// ═══════════════════════════════════════════════════════════════════════════

export * from './enums';

// ── Référentiels ─────────────────────────────────────────────────────────────
export { Site, Emplacement }                from './site.entity';
export { FamilleArticle, Article }          from './article.entity';
export {
  Fournisseur, FournisseurContact,
  CatalogueFournisseur, PalierPrix, Client,
}                                           from './fournisseur.entity';

// ── Stocks ───────────────────────────────────────────────────────────────────
export { Lot, MouvementStock }              from './stock.entity';

// ── Achats ───────────────────────────────────────────────────────────────────
export {
  DemandeAchat, CommandeAchat,
  LigneCommandeAchat, Reception, LigneReception,
}                                           from './achat.entity';

// ── Production ───────────────────────────────────────────────────────────────
export {
  PosteCharge, Gamme, OperationGamme,
  Nomenclature, OrdreFabrication,
  DeclarationProduction, ConsommationMp,
}                                           from './production.entity';

// ── Qualité ──────────────────────────────────────────────────────────────────
export {
  PlanControle, CritereControle,
  ControleReception, MesureControle, NonConformite,
}                                           from './qualite.entity';

// ── Expéditions ──────────────────────────────────────────────────────────────
export {
  CommandeClient, LigneCommandeClient,
  BonLivraison, LigneBl,
}                                           from './expedition.entity';

// ── Système ──────────────────────────────────────────────────────────────────
export { Utilisateur, AuditLog, Notification } from './expedition.entity';

// ── Liste complète pour TypeORM (autoLoadEntities dans app.module.ts) ────────
export const ALL_ENTITIES = [
  // Référentiels
  'Site', 'Emplacement',
  'FamilleArticle', 'Article',
  'Fournisseur', 'FournisseurContact', 'CatalogueFournisseur', 'PalierPrix', 'Client',
  // Stocks
  'Lot', 'MouvementStock',
  // Achats
  'DemandeAchat', 'CommandeAchat', 'LigneCommandeAchat', 'Reception', 'LigneReception',
  // Production
  'PosteCharge', 'Gamme', 'OperationGamme', 'Nomenclature',
  'OrdreFabrication', 'DeclarationProduction', 'ConsommationMp',
  // Qualité
  'PlanControle', 'CritereControle', 'ControleReception', 'MesureControle', 'NonConformite',
  // Expéditions
  'CommandeClient', 'LigneCommandeClient', 'BonLivraison', 'LigneBl',
  // Système
  'Utilisateur', 'AuditLog', 'Notification',
]; // 36 entities ✓
