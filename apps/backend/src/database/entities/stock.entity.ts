import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Article } from './article.entity';
import { Site, Emplacement } from './site.entity';
import { Fournisseur } from './fournisseur.entity';
import { StatutLot, MouvementType } from './enums';

@Entity('lots')
@Index(['articleId'])
@Index(['statut'])
@Index(['dateDluo'])
export class Lot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 60, unique: true })
  numero: string;

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

  @Column({ name: 'emplacement_id', nullable: true })
  emplacementId: string;

  @ManyToOne(() => Emplacement, { nullable: true })
  @JoinColumn({ name: 'emplacement_id' })
  emplacement: Emplacement;

  // ── Traçabilité fournisseur ─────────────────────────────────────────────
  @Column({ name: 'lot_fournisseur', length: 60, nullable: true })
  lotFournisseur: string;

  @Column({ name: 'fournisseur_id', nullable: true })
  fournisseurId: string;

  @ManyToOne(() => Fournisseur, { nullable: true })
  @JoinColumn({ name: 'fournisseur_id' })
  fournisseur: Fournisseur;

  @Column({ name: 'commande_achat_id', nullable: true })
  commandeAchatId: string;

  // ── Dates ────────────────────────────────────────────────────────────────
  @Column({ name: 'date_fabrication', type: 'date', nullable: true })
  dateFabrication: Date;

  @Column({ name: 'date_reception', type: 'date', default: () => 'CURRENT_DATE' })
  dateReception: Date;

  // RG06 : date_dluo immuable après création (protégée par trigger PostgreSQL)
  @Column({ name: 'date_dluo', type: 'date', nullable: true })
  dateDluo: Date;

  // ── Quantités ────────────────────────────────────────────────────────────
  @Column({ name: 'quantite_initiale', type: 'decimal', precision: 12, scale: 3 })
  quantiteInitiale: number;

  // ── Statut ───────────────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: StatutLot, default: StatutLot.DISPONIBLE })
  statut: StatutLot;

  // ── Documents ────────────────────────────────────────────────────────────
  @Column({ name: 'certificat_url', type: 'text', nullable: true })
  certificatUrl: string;

  // ── Qualité ──────────────────────────────────────────────────────────────
  @Column({ name: 'resultat_controle', length: 20, nullable: true })
  resultatControle: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('mouvements_stock')
@Index(['articleId'])
@Index(['lotId'])
@Index(['createdAt'])
export class MouvementStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ name: 'site_id' })
  siteId: string;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @Column({ name: 'emplacement_id', nullable: true })
  emplacementId: string;

  @ManyToOne(() => Emplacement, { nullable: true })
  @JoinColumn({ name: 'emplacement_id' })
  emplacement: Emplacement;

  // ── Mouvement ────────────────────────────────────────────────────────────
  @Column({ name: 'type_mouvement', type: 'enum', enum: MouvementType })
  typeMouvement: MouvementType;

  // CHECK (quantite > 0) géré par PostgreSQL
  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantite: number;

  // CHECK (sens IN (-1, 1)) géré par PostgreSQL
  @Column({ type: 'smallint' })
  sens: number;

  // ── Origine polymorphique ────────────────────────────────────────────────
  @Column({ name: 'origine_type', length: 30, nullable: true })
  origineType: string;

  @Column({ name: 'origine_id', nullable: true })
  origineId: string;

  @Column({ name: 'prix_unitaire', type: 'decimal', precision: 14, scale: 4, default: 0 })
  prixUnitaire: number;

  @Column({ type: 'text', nullable: true })
  commentaire: string;

  // ── Audit (RG05) ──────────────────────────────────────────────────────────
  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}