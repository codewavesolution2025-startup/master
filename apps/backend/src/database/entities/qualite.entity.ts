import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { Article } from './article.entity';
import { Fournisseur } from './fournisseur.entity';
import { Lot } from './stock.entity';
import { Reception } from './achat.entity';
import { OrdreFabrication } from './production.entity';
import { NiveauControle, StatutNC, DecisionNC } from './enums';

@Entity('plans_controle')
export class PlanControle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'article_id' })
  articleId: string;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ name: 'fournisseur_id', nullable: true })
  fournisseurId: string;

  @ManyToOne(() => Fournisseur, { nullable: true })
  @JoinColumn({ name: 'fournisseur_id' })
  fournisseur: Fournisseur;

  @Column({ type: 'enum', enum: NiveauControle, default: NiveauControle.NORMAL })
  niveau: NiveauControle;

  @Column({ name: 'frequence_pct', type: 'decimal', precision: 5, scale: 2, default: 100 })
  frequencePct: number;

  @Column({ name: 'taille_echantillon', type: 'int', default: 5 })
  tailleEchantillon: number;

  @Column({ default: true })
  actif: boolean;

  @OneToMany(() => CritereControle, (c) => c.plan)
  criteres: CritereControle[];
}

@Entity('criteres_controle')
export class CritereControle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id' })
  planId: string;

  @ManyToOne(() => PlanControle, (p) => p.criteres, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: PlanControle;

  @Column({ length: 150 })
  libelle: string;

  @Column({ name: 'type_mesure', length: 30, nullable: true })
  typeMesure: string;

  @Column({ name: 'valeur_nominale', type: 'decimal', precision: 14, scale: 6, nullable: true })
  valeurNominale: number;

  @Column({ name: 'tolerance_plus', type: 'decimal', precision: 14, scale: 6, nullable: true })
  tolerancePlus: number;

  @Column({ name: 'tolerance_moins', type: 'decimal', precision: 14, scale: 6, nullable: true })
  toleranceMoins: number;

  @Column({ length: 20, nullable: true })
  unite: string;

  @Column({ type: 'text', nullable: true })
  methode: string;
}

@Entity('controles_reception')
export class ControleReception {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reception_id' })
  receptionId: string;

  @ManyToOne(() => Reception)
  @JoinColumn({ name: 'reception_id' })
  reception: Reception;

  @Column({ name: 'lot_id' })
  lotId: string;

  @ManyToOne(() => Lot)
  @JoinColumn({ name: 'lot_id' })
  lot: Lot;

  @Column({ name: 'plan_id' })
  planId: string;

  @ManyToOne(() => PlanControle)
  @JoinColumn({ name: 'plan_id' })
  plan: PlanControle;

  @Column({ name: 'date_controle', default: () => 'NOW()' })
  dateControle: Date;

  @Column({ name: 'controleur_id' })
  controleurId: string;

  @Column({ length: 10, nullable: true })
  resultat: string;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @OneToMany(() => MesureControle, (m) => m.controle)
  mesures: MesureControle[];
}

@Entity('mesures_controle')
export class MesureControle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'controle_id' })
  controleId: string;

  @ManyToOne(() => ControleReception, (c) => c.mesures, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'controle_id' })
  controle: ControleReception;

  @Column({ name: 'critere_id' })
  critereId: string;

  @ManyToOne(() => CritereControle)
  @JoinColumn({ name: 'critere_id' })
  critere: CritereControle;

  @Column({ name: 'valeur_mesuree', type: 'decimal', precision: 14, scale: 6, nullable: true })
  valeurMesuree: number;

  @Column({ nullable: true })
  conforme: boolean;
}

@Entity('non_conformites')
@Index(['statut', 'createdAt'])
@Index(['fournisseurId', 'createdAt'])
export class NonConformite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30, unique: true })
  reference: string;

  @Column({ type: 'enum', enum: StatutNC, default: StatutNC.OUVERTE })
  statut: StatutNC;

  @Column({ name: 'type_detection', length: 30, nullable: true })
  typeDetection: string;

  @Column({ name: 'controle_id', nullable: true })
  controleId: string;

  @ManyToOne(() => ControleReception, { nullable: true })
  @JoinColumn({ name: 'controle_id' })
  controle: ControleReception;

  @Column({ name: 'of_id', nullable: true })
  ofId: string;

  @ManyToOne(() => OrdreFabrication, { nullable: true })
  @JoinColumn({ name: 'of_id' })
  of: OrdreFabrication;

  @Column({ name: 'fournisseur_id', nullable: true })
  fournisseurId: string;

  @ManyToOne(() => Fournisseur, { nullable: true })
  @JoinColumn({ name: 'fournisseur_id' })
  fournisseur: Fournisseur;

  @Column({ name: 'article_id' })
  articleId: string;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  // Tableau d'UUIDs des lots concernés
  @Column({ name: 'lots_concernes', type: 'uuid', array: true, nullable: true })
  lotsConcernes: string[];

  @Column({ length: 20, nullable: true })
  severite: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'photos_urls', type: 'text', array: true, nullable: true })
  photosUrls: string[];

  @Column({ name: 'cause_probable', type: 'text', nullable: true })
  causeProbable: string;

  @Column({ type: 'enum', enum: DecisionNC, nullable: true })
  decision: DecisionNC;

  @Column({ name: 'decision_par', nullable: true })
  decisionPar: string;

  @Column({ name: 'date_decision', nullable: true })
  dateDecision: Date;

  @Column({ name: 'commentaire_dec', type: 'text', nullable: true })
  commentaireDec: string;

  @Column({ name: 'action_corrective', type: 'text', nullable: true })
  actionCorrective: string;

  @Column({ name: 'responsable_ac', nullable: true })
  responsableAc: string;

  @Column({ name: 'delai_ac', type: 'date', nullable: true })
  delaiAc: Date;

  @Column({ name: 'date_realisation_ac', nullable: true })
  dateRealisationAc: Date;

  @Column({ name: 'efficacite_verifiee', default: false })
  efficaciteVerifiee: boolean;

  @Column({ name: 'cout_estime', type: 'decimal', precision: 12, scale: 2, default: 0 })
  coutEstime: number;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
