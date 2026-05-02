import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { Article } from './article.entity';
import { Client } from './fournisseur.entity';
import { Lot, MouvementStock } from './stock.entity';
import { StatutCommandeClient, UserRole } from './enums';

@Entity('commandes_clients')
export class CommandeClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30, unique: true })
  reference: string;

  @Column({ name: 'ref_client', length: 60, nullable: true })
  refClient: string;

  @Column({ name: 'client_id' })
  clientId: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'enum', enum: StatutCommandeClient, default: StatutCommandeClient.RECUE })
  statut: StatutCommandeClient;

  @Column({ name: 'date_commande', type: 'date', default: () => 'CURRENT_DATE' })
  dateCommande: Date;

  @Column({ name: 'date_livraison_prev', type: 'date', nullable: true })
  dateLivraisonPrev: Date;

  @Column({ name: 'date_livraison_conf', type: 'date', nullable: true })
  dateLivraisonConf: Date;

  @Column({ name: 'adresse_livraison', type: 'text', nullable: true })
  adresseLivraison: string;

  @Column({ length: 10, nullable: true })
  incoterm: string;

  @Column({ length: 3, default: 'EUR' })
  devise: string;

  @Column({ name: 'montant_ht', type: 'decimal', precision: 14, scale: 2, default: 0 })
  montantHt: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => LigneCommandeClient, (l) => l.commande)
  lignes: LigneCommandeClient[];

  @OneToMany(() => BonLivraison, (b) => b.commande)
  bonsLivraison: BonLivraison[];
}

@Entity('lignes_commande_client')
export class LigneCommandeClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'commande_id' })
  commandeId: string;

  @ManyToOne(() => CommandeClient, (c) => c.lignes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commande_id' })
  commande: CommandeClient;

  @Column({ name: 'article_id' })
  articleId: string;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ name: 'num_ligne', type: 'int' })
  numLigne: number;

  @Column({ name: 'quantite_commandee', type: 'decimal', precision: 12, scale: 3 })
  quantiteCommandee: number;

  @Column({ name: 'quantite_expediee', type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantiteExpediee: number;

  @Column({ name: 'prix_unitaire', type: 'decimal', precision: 14, scale: 4 })
  prixUnitaire: number;

  @Column({ name: 'date_livr_souhaitee', type: 'date', nullable: true })
  dateLivrSouhaitee: Date;

  @Column({ name: 'statut_ligne', length: 20, default: 'EN_ATTENTE' })
  statutLigne: string;
}

@Entity('bons_livraison')
export class BonLivraison {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30, unique: true })
  reference: string;

  @Column({ name: 'commande_id' })
  commandeId: string;

  @ManyToOne(() => CommandeClient, (c) => c.bonsLivraison)
  @JoinColumn({ name: 'commande_id' })
  commande: CommandeClient;

  @Column({ name: 'date_expedition', type: 'date', default: () => 'CURRENT_DATE' })
  dateExpedition: Date;

  @Column({ length: 100, nullable: true })
  transporteur: string;

  @Column({ name: 'numero_tracking', length: 80, nullable: true })
  numeroTracking: string;

  @Column({ name: 'poids_total_kg', type: 'decimal', precision: 10, scale: 3, nullable: true })
  poidsTotalKg: number;

  @Column({ name: 'nb_colis', type: 'int', default: 1 })
  nbColis: number;

  @Column({ length: 20, default: 'PREPARE' })
  statut: string;

  @Column({ name: 'date_livraison', type: 'date', nullable: true })
  dateLivraison: Date;

  @Column({ name: 'pod_url', type: 'text', nullable: true })
  podUrl: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => LigneBl, (l) => l.bl)
  lignes: LigneBl[];
}

@Entity('lignes_bl')
export class LigneBl {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bl_id' })
  blId: string;

  @ManyToOne(() => BonLivraison, (b) => b.lignes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bl_id' })
  bl: BonLivraison;

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

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantite: number;

  @Column({ name: 'mouvement_id', nullable: true })
  mouvementId: string;

  @ManyToOne(() => MouvementStock, { nullable: true })
  @JoinColumn({ name: 'mouvement_id' })
  mouvement: MouvementStock;
}

// ─── Utilisateurs ─────────────────────────────────────────────────────────────

@Entity('utilisateurs')
export class Utilisateur {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ length: 150, unique: true })
  email: string;

  @Column({ length: 80 })
  nom: string;

  @Column({ length: 80 })
  prenom: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ name: 'site_id', nullable: true })
  siteId: string;

  @Column({ default: true })
  actif: boolean;

  @Column({ name: 'last_login', nullable: true })
  lastLogin: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

@Entity('audit_log')
@Index(['tableName', 'recordId'])
@Index(['changedAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'table_name', length: 60 })
  tableName: string;

  @Column({ name: 'record_id' })
  recordId: string;

  @Column({ length: 10 })
  action: string;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues: object;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues: object;

  @Column({ name: 'changed_by' })
  changedBy: string;

  @Column({ name: 'changed_at', default: () => 'NOW()' })
  changedAt: Date;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

@Entity('notifications')
@Index(['destinataire', 'lue', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  type: string;

  @Column({ length: 200 })
  titre: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ length: 10, default: 'NORMAL' })
  priorite: string;

  @Column({ nullable: true })
  destinataire: string;

  @ManyToOne(() => Utilisateur, { nullable: true })
  @JoinColumn({ name: 'destinataire' })
  utilisateur: Utilisateur;

  @Column({ default: false })
  lue: boolean;

  @Column({ name: 'date_lecture', nullable: true })
  dateLecture: Date;

  @Column({ name: 'lien_entite', length: 200, nullable: true })
  lienEntite: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
