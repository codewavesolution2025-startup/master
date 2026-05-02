import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { Article } from './article.entity';
import { Site, Emplacement } from './site.entity';
import { Fournisseur } from './fournisseur.entity';
import { Lot } from './stock.entity';
import { MouvementStock } from './stock.entity';
import { StatutCA } from './enums';

@Entity('demandes_achat')
export class DemandeAchat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30, unique: true })
  reference: string;

  @Column({ name: 'article_id' })
  articleId: string;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ name: 'site_id' })
  siteId: string;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantite: number;

  @Column({ name: 'date_souhaitee', type: 'date', nullable: true })
  dateSouhaitee: Date;

  @Column({ type: 'text', nullable: true })
  justification: string;

  @Column({ length: 20, default: 'EN_ATTENTE' })
  statut: string;

  @Column({ length: 20, nullable: true })
  origine: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'valide_par', nullable: true })
  validePar: string;

  @Column({ name: 'date_validation', nullable: true })
  dateValidation: Date;

  @Column({ name: 'commentaire_valid', type: 'text', nullable: true })
  commentaireValid: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('commandes_achat')
@Index(['fournisseurId', 'statut'])
@Index(['statut', 'dateLivraisonPrev'])
export class CommandeAchat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30, unique: true })
  reference: string;

  @Column({ name: 'fournisseur_id' })
  fournisseurId: string;

  @ManyToOne(() => Fournisseur)
  @JoinColumn({ name: 'fournisseur_id' })
  fournisseur: Fournisseur;

  @Column({ name: 'site_livraison_id' })
  siteLivraisonId: string;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'site_livraison_id' })
  siteLivraison: Site;

  @Column({ type: 'enum', enum: StatutCA, default: StatutCA.BROUILLON })
  statut: StatutCA;

  // ── Dates ────────────────────────────────────────────────────────────────
  @Column({ name: 'date_commande', type: 'date', default: () => 'CURRENT_DATE' })
  dateCommande: Date;

  @Column({ name: 'date_livraison_prev', type: 'date', nullable: true })
  dateLivraisonPrev: Date;

  @Column({ name: 'date_ar_fournisseur', nullable: true })
  dateArFournisseur: Date;

  // ── Conditions ───────────────────────────────────────────────────────────
  @Column({ length: 10, nullable: true })
  incoterm: string;

  @Column({ name: 'mode_paiement', length: 20, nullable: true })
  modePaiement: string;

  @Column({ name: 'delai_paiement', type: 'int', nullable: true })
  delaiPaiement: number;

  @Column({ length: 3, default: 'EUR' })
  devise: string;

  @Column({ name: 'taux_change', type: 'decimal', precision: 10, scale: 6, default: 1 })
  tauxChange: number;

  // ── Totaux ───────────────────────────────────────────────────────────────
  @Column({ name: 'montant_ht', type: 'decimal', precision: 14, scale: 2, default: 0 })
  montantHt: number;

  @Column({ name: 'montant_tva', type: 'decimal', precision: 14, scale: 2, default: 0 })
  montantTva: number;

  @Column({ name: 'montant_ttc', type: 'decimal', precision: 14, scale: 2, default: 0 })
  montantTtc: number;

  @Column({ name: 'notes_internes', type: 'text', nullable: true })
  notesInternes: string;

  @Column({ name: 'conditions_part', type: 'text', nullable: true })
  conditionsPart: string;

  // ── Workflow ─────────────────────────────────────────────────────────────
  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'valide_par', nullable: true })
  validePar: string;

  @Column({ name: 'date_validation', nullable: true })
  dateValidation: Date;

  @Column({ name: 'envoye_par', nullable: true })
  envoyePar: string;

  @Column({ name: 'date_envoi', nullable: true })
  dateEnvoi: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => LigneCommandeAchat, (l) => l.commande)
  lignes: LigneCommandeAchat[];

  @OneToMany(() => Reception, (r) => r.commandeAchat)
  receptions: Reception[];
}

@Entity('lignes_commande_achat')
export class LigneCommandeAchat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'commande_id' })
  commandeId: string;

  @ManyToOne(() => CommandeAchat, (c) => c.lignes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commande_id' })
  commande: CommandeAchat;

  @Column({ name: 'article_id' })
  articleId: string;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ name: 'ref_article_four', length: 60, nullable: true })
  refArticleFour: string;

  @Column({ name: 'quantite_commandee', type: 'decimal', precision: 12, scale: 3 })
  quantiteCommandee: number;

  @Column({ name: 'quantite_recue', type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantiteRecue: number;

  @Column({ length: 10, nullable: true })
  unite: string;

  @Column({ name: 'prix_unitaire', type: 'decimal', precision: 14, scale: 4 })
  prixUnitaire: number;

  @Column({ name: 'remise_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  remisePct: number;

  // GENERATED ALWAYS AS côté PostgreSQL — lecture seule dans TypeORM
  @Column({ name: 'prix_net', type: 'decimal', precision: 14, scale: 4, insert: false, update: false })
  prixNet: number;

  @Column({ name: 'montant_ligne', type: 'decimal', precision: 14, scale: 2, insert: false, update: false })
  montantLigne: number;

  @Column({ name: 'date_livr_souhaitee', type: 'date', nullable: true })
  dateLivrSouhaitee: Date;

  @Column({ name: 'tolerance_pct', type: 'decimal', precision: 5, scale: 2, default: 5 })
  tolerancePct: number;

  @Column({ name: 'demande_achat_id', nullable: true })
  demandeAchatId: string;

  @ManyToOne(() => DemandeAchat, { nullable: true })
  @JoinColumn({ name: 'demande_achat_id' })
  demandeAchat: DemandeAchat;

  @Column({ name: 'statut_ligne', length: 20, default: 'EN_ATTENTE' })
  statutLigne: string;

  @Column({ name: 'num_ligne', type: 'int' })
  numLigne: number;
}

@Entity('receptions')
export class Reception {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30, unique: true })
  reference: string;

  @Column({ name: 'commande_achat_id' })
  commandeAchatId: string;

  @ManyToOne(() => CommandeAchat, (c) => c.receptions)
  @JoinColumn({ name: 'commande_achat_id' })
  commandeAchat: CommandeAchat;

  @Column({ name: 'date_reception', type: 'date', default: () => 'CURRENT_DATE' })
  dateReception: Date;

  @Column({ name: 'bl_fournisseur', length: 60, nullable: true })
  blFournisseur: string;

  @Column({ length: 100, nullable: true })
  transporteur: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @Column({ length: 20, default: 'EN_COURS' })
  statut: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => LigneReception, (l) => l.reception)
  lignes: LigneReception[];
}

@Entity('lignes_reception')
export class LigneReception {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reception_id' })
  receptionId: string;

  @ManyToOne(() => Reception, (r) => r.lignes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reception_id' })
  reception: Reception;

  @Column({ name: 'ligne_ca_id' })
  ligneCaId: string;

  @ManyToOne(() => LigneCommandeAchat)
  @JoinColumn({ name: 'ligne_ca_id' })
  ligneCA: LigneCommandeAchat;

  @Column({ name: 'article_id' })
  articleId: string;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ name: 'quantite_recue', type: 'decimal', precision: 12, scale: 3 })
  quantiteRecue: number;

  @Column({ name: 'lot_id', nullable: true })
  lotId: string;

  @ManyToOne(() => Lot, { nullable: true })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot;

  @Column({ name: 'emplacement_id', nullable: true })
  emplacementId: string;

  @ManyToOne(() => Emplacement, { nullable: true })
  @JoinColumn({ name: 'emplacement_id' })
  emplacement: Emplacement;

  @Column({ name: 'statut_controle', length: 20, default: 'EN_ATTENTE' })
  statutControle: string;

  @Column({ name: 'mouvement_stock_id', nullable: true })
  mouvementStockId: string;

  @ManyToOne(() => MouvementStock, { nullable: true })
  @JoinColumn({ name: 'mouvement_stock_id' })
  mouvementStock: MouvementStock;
}
