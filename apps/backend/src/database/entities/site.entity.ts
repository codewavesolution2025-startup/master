import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  OneToMany, ManyToOne, JoinColumn, Index,
} from 'typeorm';

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 10, unique: true })
  code: string;

  @Column({ length: 100 })
  nom: string;

  @Column({ type: 'text', nullable: true })
  adresse: string;

  @Column({ length: 80, nullable: true })
  ville: string;

  @Column({ length: 50, default: 'France' })
  pays: string;

  @Column({ default: true })
  actif: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Emplacement, (e) => e.site)
  emplacements: Emplacement[];
}

@Entity('emplacements')
@Index(['siteId', 'code'], { unique: true })
export class Emplacement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id' })
  siteId: string;

  @ManyToOne(() => Site, (s) => s.emplacements)
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @Column({ length: 20 })
  code: string;

  @Column({ length: 30, nullable: true })
  zone: string;

  @Column({ length: 100, nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  capacite: number;

  @Column({ default: true })
  actif: boolean;
}
