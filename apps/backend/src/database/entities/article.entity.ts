import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { ArticleType, NiveauControle } from './enums';
import { Site, Emplacement } from './site.entity';

@Entity('familles_articles')
export class FamilleArticle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 10, unique: true })
  code: string;

  @Column({ length: 100 })
  nom: string;

  @Column({ type: 'enum', enum: ArticleType })
  type: ArticleType;

  @OneToMany(() => Article, (a) => a.famille)
  articles: Article[];
}

@Entity('articles')
@Index(['reference'], { unique: true })
@Index(['type'])
@Index(['actif'])
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  reference: string;

  @Column({ length: 200 })
  designation: string;

  @Column({ name: 'designation_longue', type: 'text', nullable: true })
  designationLongue: string;

  @Column({ type: 'enum', enum: ArticleType })
  type: ArticleType;

  @Column({ name: 'famille_id', nullable: true })
  familleId: string;

  @ManyToOne(() => FamilleArticle, (f) => f.articles, { nullable: true })
  @JoinColumn({ name: 'famille_id' })
  famille: FamilleArticle;

  @Column({ name: 'unite_mesure', length: 10 })
  uniteMesure: string;

  // ── Seuils de stock ─────────────────────────────────────────────────────
  @Column({ name: 'stock_mini', type: 'decimal', precision: 12, scale: 3, default: 0 })
  stockMini: number;

  @Column({ name: 'stock_maxi', type: 'decimal', precision: 12, scale: 3, nullable: true })
  stockMaxi: number;

  @Column({ name: 'stock_securite', type: 'decimal', precision: 12, scale: 3, default: 0 })
  stockSecurite: number;

  // ── Réapprovisionnement ─────────────────────────────────────────────────
  @Column({ name: 'delai_reappro_jours', type: 'int', default: 0 })
  delaiReapproJours: number;

  @Column({ name: 'lot_min_commande', type: 'decimal', precision: 12, scale: 3, default: 1 })
  lotMinCommande: number;

  @Column({ name: 'multiple_commande', type: 'decimal', precision: 12, scale: 3, default: 1 })
  multipleCommande: number;

  // ── Prix ─────────────────────────────────────────────────────────────────
  @Column({ name: 'prix_achat_std', type: 'decimal', precision: 14, scale: 4, default: 0 })
  prixAchatStd: number;

  @Column({ name: 'prix_cession_std', type: 'decimal', precision: 14, scale: 4, default: 0 })
  prixCessionStd: number;

  @Column({ length: 3, default: 'EUR' })
  devise: string;

  // ── Traçabilité ──────────────────────────────────────────────────────────
  @Column({ name: 'gestion_par_lot', default: false })
  gestionParLot: boolean;

  @Column({ name: 'gestion_par_serie', default: false })
  gestionParSerie: boolean;

  @Column({ name: 'duree_vie_jours', type: 'int', nullable: true })
  dureeVieJours: number;

  // ── Caractéristiques physiques ───────────────────────────────────────────
  @Column({ name: 'poids_unitaire_kg', type: 'decimal', precision: 10, scale: 4, nullable: true })
  poidsUnitaireKg: number;

  @Column({ name: 'code_douanier', length: 10, nullable: true })
  codeDouanier: string;

  @Column({ name: 'tolerance_reception', type: 'decimal', precision: 5, scale: 2, default: 5.00 })
  toleranceReception: number;

  // ── Relations ────────────────────────────────────────────────────────────
  @Column({ name: 'fournisseur_princ_id', nullable: true })
  fournisseurPrincId: string;

  @Column({ name: 'emplacement_defaut_id', nullable: true })
  emplacementDefautId: string;

  @ManyToOne(() => Emplacement, { nullable: true })
  @JoinColumn({ name: 'emplacement_defaut_id' })
  emplacementDefaut: Emplacement;

  // ── Qualité ──────────────────────────────────────────────────────────────
  @Column({
    name: 'niveau_controle',
    type: 'enum',
    enum: NiveauControle,
    default: NiveauControle.NORMAL,
  })
  niveauControle: NiveauControle;

  // ── Statut ───────────────────────────────────────────────────────────────
  @Column({ default: true })
  actif: boolean;

  @Column({ default: false })
  obsolete: boolean;

  @Column({ name: 'date_obsolescence', type: 'date', nullable: true })
  dateObsolescence: Date;

  // ── Audit ────────────────────────────────────────────────────────────────
  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
