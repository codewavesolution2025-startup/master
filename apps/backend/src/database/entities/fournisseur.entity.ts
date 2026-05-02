import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';
import { Article } from './article.entity';

@Entity('fournisseurs')
export class Fournisseur {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true })
  code: string;

  @Column({ name: 'raison_sociale', length: 150 })
  raisonSociale: string;

  @Column({ length: 14, nullable: true })
  siret: string;

  @Column({ name: 'tva_intra', length: 20, nullable: true })
  tvaIntra: string;

  // ── Adresse facturation ─────────────────────────────────────────────────
  @Column({ name: 'adresse_fact', type: 'text', nullable: true })
  adresseFact: string;

  @Column({ name: 'ville_fact', length: 80, nullable: true })
  villeFact: string;

  @Column({ name: 'cp_fact', length: 10, nullable: true })
  cpFact: string;

  @Column({ name: 'pays_fact', length: 50, default: 'France' })
  paysFact: string;

  // ── Adresse livraison ───────────────────────────────────────────────────
  @Column({ name: 'adresse_livr', type: 'text', nullable: true })
  adresseLivr: string;

  @Column({ name: 'ville_livr', length: 80, nullable: true })
  villeLivr: string;

  @Column({ name: 'cp_livr', length: 10, nullable: true })
  cpLivr: string;

  @Column({ name: 'pays_livr', length: 50, nullable: true })
  paysLivr: string;

  // ── Conditions commerciales ─────────────────────────────────────────────
  @Column({ name: 'delai_paiement', type: 'int', default: 30 })
  delaiPaiement: number;

  @Column({ name: 'mode_paiement', length: 20, default: 'VIREMENT' })
  modePaiement: string;

  @Column({ name: 'escompte_pct', type: 'decimal', precision: 5, scale: 2, default: 0 })
  escomptePct: number;

  @Column({ length: 10, nullable: true })
  incoterm: string;

  @Column({ name: 'port_inclus', default: false })
  portInclus: boolean;

  // ── Qualité ──────────────────────────────────────────────────────────────
  @Column({ type: 'jsonb', nullable: true })
  certifications: object[];

  // RG09 : score_qualite jamais modifié manuellement — géré par fn_calcul_score
  @Column({ name: 'score_qualite', type: 'decimal', precision: 5, scale: 2, default: 100 })
  scoreQualite: number;

  // ── Statut ───────────────────────────────────────────────────────────────
  @Column({ length: 20, default: 'ACTIF' })
  statut: string;

  @Column({ name: 'date_qualification', type: 'date', nullable: true })
  dateQualification: Date;

  @Column({ default: true })
  actif: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => FournisseurContact, (c) => c.fournisseur)
  contacts: FournisseurContact[];

  @OneToMany(() => CatalogueFournisseur, (c) => c.fournisseur)
  catalogue: CatalogueFournisseur[];
}

@Entity('fournisseur_contacts')
export class FournisseurContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'fournisseur_id' })
  fournisseurId: string;

  @ManyToOne(() => Fournisseur, (f) => f.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fournisseur_id' })
  fournisseur: Fournisseur;

  @Column({ length: 30, nullable: true })
  role: string;

  @Column({ length: 100 })
  nom: string;

  @Column({ length: 80, nullable: true })
  prenom: string;

  @Column({ length: 150, nullable: true })
  email: string;

  @Column({ length: 30, nullable: true })
  telephone: string;

  @Column({ default: false })
  principal: boolean;
}

@Entity('catalogue_fournisseur')
export class CatalogueFournisseur {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'fournisseur_id' })
  fournisseurId: string;

  @ManyToOne(() => Fournisseur, (f) => f.catalogue)
  @JoinColumn({ name: 'fournisseur_id' })
  fournisseur: Fournisseur;

  @Column({ name: 'article_id' })
  articleId: string;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ name: 'ref_fournisseur', length: 60, nullable: true })
  refFournisseur: string;

  @Column({ name: 'delai_livraison', type: 'int', nullable: true })
  delaiLivraison: number;

  @Column({ name: 'prix_unitaire', type: 'decimal', precision: 14, scale: 4 })
  prixUnitaire: number;

  @Column({ length: 3, default: 'EUR' })
  devise: string;

  @Column({ name: 'lot_min', type: 'decimal', precision: 12, scale: 3, default: 1 })
  lotMin: number;

  @Column({ name: 'date_debut', type: 'date', nullable: true })
  dateDebut: Date;

  @Column({ name: 'date_fin', type: 'date', nullable: true })
  dateFin: Date;

  @Column({ default: true })
  actif: boolean;

  @OneToMany(() => PalierPrix, (p) => p.catalogueFournisseur)
  paliers: PalierPrix[];
}

@Entity('paliers_prix')
export class PalierPrix {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'catalogue_four_id' })
  catalogueFourId: string;

  @ManyToOne(() => CatalogueFournisseur, (c) => c.paliers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalogue_four_id' })
  catalogueFournisseur: CatalogueFournisseur;

  @Column({ name: 'quantite_min', type: 'decimal', precision: 12, scale: 3 })
  quantiteMin: number;

  @Column({ name: 'prix_unitaire', type: 'decimal', precision: 14, scale: 4 })
  prixUnitaire: number;
}

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true })
  code: string;

  @Column({ name: 'raison_sociale', length: 150 })
  raisonSociale: string;

  @Column({ length: 14, nullable: true })
  siret: string;

  @Column({ type: 'text', nullable: true })
  adresse: string;

  @Column({ length: 80, nullable: true })
  ville: string;

  @Column({ length: 50, default: 'France' })
  pays: string;

  @Column({ length: 150, nullable: true })
  email: string;

  @Column({ length: 30, nullable: true })
  telephone: string;

  @Column({ name: 'delai_paiement', type: 'int', default: 30 })
  delaiPaiement: number;

  @Column({ default: true })
  actif: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
