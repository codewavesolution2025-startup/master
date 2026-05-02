import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { Article } from './article.entity';
import { Site } from './site.entity';
import { Lot, MouvementStock } from './stock.entity';
import { StatutOF } from './enums';

@Entity('postes_charge')
export class PosteCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true })
  code: string;

  @Column({ length: 100 })
  libelle: string;

  @Column({ length: 20, nullable: true })
  type: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @Column({ name: 'capacite_h_jour', type: 'decimal', precision: 6, scale: 2, default: 8 })
  capaciteHJour: number;

  @Column({ name: 'cout_horaire', type: 'decimal', precision: 10, scale: 4, default: 0 })
  coutHoraire: number;

  @Column({ name: 'taux_rendement', type: 'decimal', precision: 5, scale: 2, default: 85 })
  tauxRendement: number;

  @Column({ default: true })
  actif: boolean;
}

@Entity('gammes')
@Index(['articleId', 'version'], { unique: true })
export class Gamme {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'article_id' })
  articleId: string;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ length: 30 })
  code: string;

  @Column({ length: 10, default: '1.0' })
  version: string;

  @Column({ length: 20, default: 'ACTIF' })
  statut: string;

  @Column({ name: 'date_applic', type: 'date', default: () => 'CURRENT_DATE' })
  dateApplic: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => OperationGamme, (o) => o.gamme)
  operations: OperationGamme[];
}

@Entity('operations_gamme')
@Index(['gammeId', 'numeroOp'], { unique: true })
export class OperationGamme {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'gamme_id' })
  gammeId: string;

  @ManyToOne(() => Gamme, (g) => g.operations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gamme_id' })
  gamme: Gamme;

  @Column({ name: 'numero_op', type: 'int' })
  numeroOp: number;

  @Column({ length: 150 })
  libelle: string;

  @Column({ name: 'poste_charge_id' })
  posteChargeId: string;

  @ManyToOne(() => PosteCharge)
  @JoinColumn({ name: 'poste_charge_id' })
  posteCharge: PosteCharge;

  @Column({ name: 'temps_preparation', type: 'decimal', precision: 8, scale: 2, default: 0 })
  tempsPreparation: number;

  @Column({ name: 'temps_unitaire', type: 'decimal', precision: 8, scale: 4, default: 0 })
  tempsUnitaire: number;

  @Column({ name: 'temps_nettoyage', type: 'decimal', precision: 8, scale: 2, default: 0 })
  tempsNettoyage: number;

  @Column({ name: 'nb_operateurs', type: 'int', default: 1 })
  nbOperateurs: number;

  @Column({ name: 'point_de_controle', default: false })
  pointDeControle: boolean;

  @Column({ name: 'document_url', type: 'text', nullable: true })
  documentUrl: string;

  // Tableau d'entiers (numéros des opérations antérieures)
  @Column({ type: 'int', array: true, nullable: true })
  predecesseurs: number[];
}

@Entity('nomenclatures')
@Index(['articleParent'])
@Index(['composantId'])
export class Nomenclature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'article_parent' })
  articleParent: string;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_parent' })
  parent: Article;

  @Column({ name: 'composant_id' })
  composantId: string;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'composant_id' })
  composant: Article;

  @Column({ type: 'decimal', precision: 14, scale: 6 })
  quantite: number;

  @Column({ length: 10, nullable: true })
  unite: string;

  @Column({ type: 'int', default: 1 })
  niveau: number;

  @Column({ name: 'type_lien', length: 20, default: 'FIXE' })
  typeLien: string;

  @Column({ name: 'taux_perte_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  tauxPertePct: number;

  // GENERATED ALWAYS AS côté PostgreSQL
  @Column({ name: 'qte_avec_perte', type: 'decimal', precision: 14, scale: 6, insert: false, update: false })
  qteAvecPerte: number;

  @Column({ name: 'operation_id', nullable: true })
  operationId: string;

  @ManyToOne(() => OperationGamme, { nullable: true })
  @JoinColumn({ name: 'operation_id' })
  operation: OperationGamme;

  @Column({ name: 'substitut_id', nullable: true })
  substitutId: string;

  @ManyToOne(() => Article, { nullable: true })
  @JoinColumn({ name: 'substitut_id' })
  substitut: Article;

  @Column({ name: 'date_debut', type: 'date', default: () => 'CURRENT_DATE' })
  dateDebut: Date;

  @Column({ name: 'date_fin', type: 'date', nullable: true })
  dateFin: Date;

  @Column({ default: true })
  actif: boolean;
}

@Entity('ordres_fabrication')
@Index(['statut', 'dateDebutPrevue'])
@Index(['articleId', 'statut'])
export class OrdreFabrication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30, unique: true })
  reference: string;

  @Column({ name: 'article_id' })
  articleId: string;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ name: 'gamme_id', nullable: true })
  gammeId: string;

  @ManyToOne(() => Gamme, { nullable: true })
  @JoinColumn({ name: 'gamme_id' })
  gamme: Gamme;

  @Column({ name: 'site_id' })
  siteId: string;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @Column({ type: 'enum', enum: StatutOF, default: StatutOF.PLANIFIE })
  statut: StatutOF;

  // ── Quantités ────────────────────────────────────────────────────────────
  @Column({ name: 'quantite_prevue', type: 'decimal', precision: 12, scale: 3 })
  quantitePrevue: number;

  @Column({ name: 'quantite_lancee', type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantiteLancee: number;

  @Column({ name: 'quantite_produite', type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantiteProduite: number;

  @Column({ name: 'quantite_rebut', type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantiteRebut: number;

  // ── Dates ────────────────────────────────────────────────────────────────
  @Column({ name: 'date_debut_prevue', type: 'date', nullable: true })
  dateDebutPrevue: Date;

  @Column({ name: 'date_fin_prevue', type: 'date', nullable: true })
  dateFinPrevue: Date;

  @Column({ name: 'date_debut_reelle', nullable: true })
  dateDebutReelle: Date;

  @Column({ name: 'date_fin_reelle', nullable: true })
  dateFinReelle: Date;

  @Column({ name: 'lot_pf_id', nullable: true })
  lotPfId: string;

  @ManyToOne(() => Lot, { nullable: true })
  @JoinColumn({ name: 'lot_pf_id' })
  lotPf: Lot;

  @Column({ name: 'commande_client_id', nullable: true })
  commandeClientId: string;

  // ── Coûts ────────────────────────────────────────────────────────────────
  @Column({ name: 'cout_mp_theorique', type: 'decimal', precision: 14, scale: 2, default: 0 })
  coutMpTheorique: number;

  @Column({ name: 'cout_mp_reel', type: 'decimal', precision: 14, scale: 2, default: 0 })
  coutMpReel: number;

  @Column({ name: 'cout_mo_theorique', type: 'decimal', precision: 14, scale: 2, default: 0 })
  coutMoTheorique: number;

  @Column({ name: 'cout_mo_reel', type: 'decimal', precision: 14, scale: 2, default: 0 })
  coutMoReel: number;

  @Column({ name: 'motif_suspension', type: 'text', nullable: true })
  motifSuspension: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'valide_par', nullable: true })
  validePar: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => DeclarationProduction, (d) => d.of)
  declarations: DeclarationProduction[];

  @OneToMany(() => ConsommationMp, (c) => c.of)
  consommations: ConsommationMp[];
}

@Entity('declarations_production')
export class DeclarationProduction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'of_id' })
  ofId: string;

  @ManyToOne(() => OrdreFabrication, (o) => o.declarations)
  @JoinColumn({ name: 'of_id' })
  of: OrdreFabrication;

  @Column({ name: 'operation_id' })
  operationId: string;

  @ManyToOne(() => OperationGamme)
  @JoinColumn({ name: 'operation_id' })
  operation: OperationGamme;

  @Column({ name: 'date_declaration', default: () => 'NOW()' })
  dateDeclaration: Date;

  @Column({ name: 'operateur_id' })
  operateurId: string;

  @Column({ name: 'quantite_produite', type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantiteProduite: number;

  @Column({ name: 'quantite_rebut', type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantiteRebut: number;

  @Column({ name: 'code_motif_rebut', length: 30, nullable: true })
  codeMotifRebut: string;

  @Column({ name: 'temps_preparation', type: 'decimal', precision: 8, scale: 2, default: 0 })
  tempsPreparation: number;

  @Column({ name: 'temps_production', type: 'decimal', precision: 8, scale: 2, default: 0 })
  tempsProduction: number;

  @Column({ type: 'text', nullable: true })
  commentaire: string;
}

@Entity('consommations_mp')
export class ConsommationMp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'of_id' })
  ofId: string;

  @ManyToOne(() => OrdreFabrication, (o) => o.consommations)
  @JoinColumn({ name: 'of_id' })
  of: OrdreFabrication;

  @Column({ name: 'article_id' })
  articleId: string;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ name: 'lot_id', nullable: true })
  lotId: string;

  @ManyToOne(() => Lot, { nullable: true })
  @JoinColumn({ name: 'lot_id' })
  lot: Lot;

  @Column({ name: 'qte_theorique', type: 'decimal', precision: 12, scale: 3 })
  qteTheorique: number;

  @Column({ name: 'qte_reelle', type: 'decimal', precision: 12, scale: 3, default: 0 })
  qteReelle: number;

  // GENERATED ALWAYS AS côté PostgreSQL
  @Column({ name: 'ecart_qte', type: 'decimal', precision: 12, scale: 3, insert: false, update: false })
  ecartQte: number;

  @Column({ name: 'mouvement_id', nullable: true })
  mouvementId: string;

  @ManyToOne(() => MouvementStock, { nullable: true })
  @JoinColumn({ name: 'mouvement_id' })
  mouvement: MouvementStock;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
