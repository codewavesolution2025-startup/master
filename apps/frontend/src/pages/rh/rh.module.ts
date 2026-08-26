import {
  Controller, Get, Post, Put, Delete, Body, Param,
  Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, IsBoolean, Min } from 'class-validator';


// ── DTOs ─────────────────────────────────────────────────────

export class CreateEmployeDto {
  @IsString() matricule: string;
  @IsString() nom: string;
  @IsString() prenom: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsDateString() date_naissance?: string;
  @IsDateString() date_embauche: string;
  @IsString() poste: string;
  @IsOptional() @IsString() service?: string;
  @IsOptional() @IsString() site_id?: string;
  @IsOptional() @IsString() statut?: string;
  @IsOptional() @IsString() type_contrat?: string;
  @IsNumber() taux_horaire: number;
  @IsOptional() @IsNumber() nb_heures_semaine?: number;
  @IsOptional() @IsNumber() cout_charges_pct?: number;
  @IsOptional() @IsNumber() nb_conges_annuels?: number;
  @IsOptional() @IsNumber() nb_rtt_annuels?: number;
  @IsOptional() @IsString() notes?: string;
}

export class CreatePresenceDto {
  @IsString() employe_id: string;
  @IsDateString() date_presence: string;
  @IsOptional() @IsString() heure_entree?: string;
  @IsOptional() @IsString() heure_sortie?: string;
  @IsOptional() @IsNumber() heures_sup?: number;
  @IsOptional() @IsString() type_journee?: string;
  @IsOptional() @IsString() commentaire?: string;
}

export class CreateCongeDto {
  @IsString() employe_id: string;
  @IsString() type_absence: string;
  @IsDateString() date_debut: string;
  @IsDateString() date_fin: string;
  @IsOptional() @IsString() motif?: string;
}

export class CreateFichePaieDto {
  @IsString() employe_id: string;
  @IsNumber() periode_mois: number;
  @IsNumber() periode_annee: number;
  @IsOptional() @IsNumber() nb_heures_travaillees?: number;
  @IsOptional() @IsNumber() nb_heures_sup?: number;
  @IsOptional() @IsNumber() nb_jours_conge?: number;
  @IsOptional() @IsNumber() primes?: number;
  @IsOptional() @IsNumber() retenues?: number;
}

// ── Service ───────────────────────────────────────────────────

@Injectable()
export class RhService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // Dashboard KPIs
  async getDashboardKpis() {
    const [effectif, couts, conges, formations, presences] = await Promise.all([
      this.db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE statut='ACTIF') as actifs,
          COUNT(*) FILTER (WHERE type_contrat='CDI') as cdi,
          COUNT(*) FILTER (WHERE type_contrat='CDD') as cdd,
          COUNT(*) FILTER (WHERE type_contrat='INTERIM') as interim,
          COUNT(*) FILTER (WHERE type_contrat='APPRENTISSAGE') as apprentis,
          COUNT(DISTINCT service) as nb_services,
          ROUND(AVG(EXTRACT(YEAR FROM AGE(date_naissance)))::numeric,1) as age_moyen
        FROM employes WHERE statut='ACTIF'
      `),
      this.db.query(`
        SELECT
          ROUND(SUM(cout_total_mo)::numeric,2) as cout_mo_mois,
          ROUND(SUM(salaire_brut)::numeric,2) as masse_salariale,
          ROUND(SUM(charges_patronales)::numeric,2) as charges_totales,
          ROUND(AVG(cout_total_mo)::numeric,2) as cout_mo_moyen
        FROM fiches_paie
        WHERE periode_mois = EXTRACT(MONTH FROM NOW())
          AND periode_annee = EXTRACT(YEAR FROM NOW())
          AND statut IN ('VALIDEE','BROUILLON')
      `),
      this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE statut='EN_ATTENTE') as en_attente,
          COUNT(*) FILTER (WHERE statut='APPROUVE' AND date_debut >= NOW()) as a_venir,
          SUM(nb_jours) FILTER (WHERE statut='APPROUVE' AND EXTRACT(YEAR FROM date_debut)=EXTRACT(YEAR FROM NOW())) as jours_pris_annee
        FROM conges
      `),
      this.db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE statut='PLANIFIEE') as planifiees,
          ROUND(SUM(ef.cout_reel)::numeric,2) as cout_total
        FROM formations f
        LEFT JOIN employe_formations ef ON ef.formation_id = f.id
      `),
      this.db.query(`
        SELECT
          ROUND(AVG(heures_travaillees)::numeric,2) as heures_moy_jour,
          SUM(heures_sup) as total_heures_sup,
          COUNT(DISTINCT employe_id) as employes_presents
        FROM presences
        WHERE date_presence >= NOW() - INTERVAL '30 days'
      `),
    ]);

    return {
      effectif: effectif[0],
      couts: couts[0],
      conges: conges[0],
      formations: formations[0],
      presences: presences[0],
    };
  }

  // Coût MO par OF
  async getCoutMoParOf() {
    return this.db.query(`
      SELECT
        of2.reference as of_ref,
        a.reference as article,
        of2.quantite_prevue,
        of2.quantite_produite,
        COALESCE(SUM(dp.temps_production) / 60.0, 0) as heures_prod,
        ROUND(
          COALESCE(SUM(dp.temps_production) / 60.0, 0) *
          COALESCE(AVG(e.taux_horaire * (1 + e.cout_charges_pct/100)), 0)
        ::numeric, 2) as cout_mo_estime
      FROM ordres_fabrication of2
      JOIN articles a ON a.id = of2.article_id
      LEFT JOIN declarations_production dp ON dp.of_id = of2.id
      LEFT JOIN employes e ON e.id = dp.operateur_id AND e.statut='ACTIF'
      GROUP BY of2.id, of2.reference, a.reference, of2.quantite_prevue, of2.quantite_produite
      ORDER BY of2.created_at DESC
      LIMIT 10
    `).catch(() => []);
  }

  // Employés
  async findAllEmployes(filters: any) {
    const { service, statut, site_id, search } = filters;
    let sql = `
      SELECT e.*, s.nom as site_nom,
        (SELECT COUNT(*) FROM employe_competences ec WHERE ec.employe_id = e.id) as nb_competences,
        (SELECT COUNT(*) FROM conges c WHERE c.employe_id = e.id AND c.statut='EN_ATTENTE') as conges_en_attente
      FROM employes e
      LEFT JOIN sites s ON s.id = e.site_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (statut) { sql += ` AND e.statut = $${idx++}`; params.push(statut); }
    if (service) { sql += ` AND e.service = $${idx++}`; params.push(service); }
    if (site_id) { sql += ` AND e.site_id = $${idx++}`; params.push(site_id); }
    if (search) { sql += ` AND (e.nom ILIKE $${idx} OR e.prenom ILIKE $${idx} OR e.matricule ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    sql += ` ORDER BY e.nom, e.prenom`;
    return this.db.query(sql, params);
  }

  async findOneEmploye(id: string) {
    const [employe, competences, conges, formations, fiches] = await Promise.all([
      this.db.query(`
        SELECT e.*, s.nom as site_nom FROM employes e
        LEFT JOIN sites s ON s.id = e.site_id WHERE e.id = $1
      `, [id]),
      this.db.query(`
        SELECT ec.*, c.libelle, c.categorie, c.code FROM employe_competences ec
        JOIN competences c ON c.id = ec.competence_id WHERE ec.employe_id = $1
      `, [id]),
      this.db.query(`
        SELECT * FROM conges WHERE employe_id = $1 ORDER BY date_debut DESC LIMIT 10
      `, [id]),
      this.db.query(`
        SELECT ef.*, f.intitule, f.organisme, f.duree_jours FROM employe_formations ef
        JOIN formations f ON f.id = ef.formation_id WHERE ef.employe_id = $1
      `, [id]),
      this.db.query(`
        SELECT * FROM fiches_paie WHERE employe_id = $1 ORDER BY periode_annee DESC, periode_mois DESC LIMIT 6
      `, [id]),
    ]);
    if (!employe.length) throw new NotFoundException('Employé introuvable');
    return { ...employe[0], competences, conges, formations, fiches };
  }

  async createEmploye(dto: any) {
    const res = await this.db.query(`
      INSERT INTO employes (matricule, nom, prenom, email, telephone, date_naissance,
        date_embauche, poste, service, site_id, statut, type_contrat, taux_horaire,
        nb_heures_semaine, cout_charges_pct, nb_conges_annuels, nb_rtt_annuels, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `, [dto.matricule, dto.nom, dto.prenom, dto.email, dto.telephone, dto.date_naissance,
        dto.date_embauche, dto.poste, dto.service, dto.site_id, dto.statut || 'ACTIF',
        dto.type_contrat || 'CDI', dto.taux_horaire, dto.nb_heures_semaine || 35,
        dto.cout_charges_pct || 45, dto.nb_conges_annuels || 25, dto.nb_rtt_annuels || 10, dto.notes]);
    return res[0];
  }

  async updateEmploye(id: string, dto: any) {
    const fields = Object.keys(dto).filter(k => dto[k] !== undefined);
    if (!fields.length) return this.findOneEmploye(id);
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const vals = fields.map(f => dto[f]);
    await this.db.query(`UPDATE employes SET ${sets}, updated_at=NOW() WHERE id=$1`, [id, ...vals]);
    return this.findOneEmploye(id);
  }

  // Présences
  async getPresences(filters: any) {
    const { employe_id, date_debut, date_fin } = filters;
    let sql = `
      SELECT p.*, e.nom, e.prenom, e.matricule, e.poste
      FROM presences p JOIN employes e ON e.id = p.employe_id WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (employe_id) { sql += ` AND p.employe_id=$${idx++}`; params.push(employe_id); }
    if (date_debut) { sql += ` AND p.date_presence >= $${idx++}`; params.push(date_debut); }
    if (date_fin) { sql += ` AND p.date_presence <= $${idx++}`; params.push(date_fin); }
    sql += ` ORDER BY p.date_presence DESC, e.nom LIMIT 200`;
    return this.db.query(sql, params);
  }

  async createPresence(dto: any) {
    const res = await this.db.query(`
      INSERT INTO presences (employe_id, date_presence, heure_entree, heure_sortie, heures_sup, type_journee, commentaire)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (employe_id, date_presence)
      DO UPDATE SET heure_entree=$3, heure_sortie=$4, heures_sup=$5, updated_at=NOW()
      RETURNING *
    `, [dto.employe_id, dto.date_presence, dto.heure_entree, dto.heure_sortie,
        dto.heures_sup || 0, dto.type_journee || 'NORMAL', dto.commentaire]);
    return res[0];
  }

  // Congés
  async getConges(filters: any) {
    const { employe_id, statut, type_absence } = filters;
    let sql = `
      SELECT c.*, e.nom, e.prenom, e.matricule, e.service
      FROM conges c JOIN employes e ON e.id = c.employe_id WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (employe_id) { sql += ` AND c.employe_id=$${idx++}`; params.push(employe_id); }
    if (statut) { sql += ` AND c.statut=$${idx++}`; params.push(statut); }
    if (type_absence) { sql += ` AND c.type_absence=$${idx++}`; params.push(type_absence); }
    sql += ` ORDER BY c.date_debut DESC LIMIT 100`;
    return this.db.query(sql, params);
  }

  async createConge(dto: any) {
    const res = await this.db.query(`
      INSERT INTO conges (employe_id, type_absence, date_debut, date_fin, motif, statut)
      VALUES ($1,$2,$3,$4,$5,'EN_ATTENTE') RETURNING *
    `, [dto.employe_id, dto.type_absence, dto.date_debut, dto.date_fin, dto.motif]);
    return res[0];
  }

  async approuverConge(id: string, approuve: boolean, commentaire?: string) {
    const statut = approuve ? 'APPROUVE' : 'REFUSE';
    const res = await this.db.query(`
      UPDATE conges SET statut=$2, date_approbation=NOW(), commentaire_rh=$3 WHERE id=$1 RETURNING *
    `, [id, statut, commentaire]);
    return res[0];
  }

  // Compétences
  async getCompetences() {
    return this.db.query(`
      SELECT c.*,
        COUNT(ec.id) as nb_employes,
        COUNT(ec.id) FILTER (WHERE ec.niveau='EXPERT') as nb_experts
      FROM competences c
      LEFT JOIN employe_competences ec ON ec.competence_id = c.id
      GROUP BY c.id ORDER BY c.categorie, c.libelle
    `);
  }

  async getMatriceCompetences() {
    return this.db.query(`
      SELECT e.matricule, e.nom, e.prenom, e.poste, e.service,
        json_object_agg(c.code, ec.niveau) as competences
      FROM employes e
      LEFT JOIN employe_competences ec ON ec.employe_id = e.id
      LEFT JOIN competences c ON c.id = ec.competence_id
      WHERE e.statut='ACTIF'
      GROUP BY e.id, e.matricule, e.nom, e.prenom, e.poste, e.service
      ORDER BY e.service, e.nom
    `);
  }

  // Formations
  async getFormations(filters: any) {
    const { statut } = filters;
    let sql = `
      SELECT f.*,
        COUNT(ef.id) as nb_inscrits,
        ROUND(COALESCE(SUM(ef.cout_reel), f.cout_unitaire * COUNT(ef.id))::numeric,2) as cout_total
      FROM formations f
      LEFT JOIN employe_formations ef ON ef.formation_id = f.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (statut) { sql += ` AND f.statut=$1`; params.push(statut); }
    sql += ` GROUP BY f.id ORDER BY f.date_debut DESC NULLS LAST`;
    return this.db.query(sql, params);
  }

  // Fiches de paie
  async getFichesPaie(filters: any) {
    const { employe_id, periode_mois, periode_annee } = filters;
    let sql = `
      SELECT fp.*, e.nom, e.prenom, e.matricule, e.poste, e.service
      FROM fiches_paie fp JOIN employes e ON e.id = fp.employe_id WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (employe_id) { sql += ` AND fp.employe_id=$${idx++}`; params.push(employe_id); }
    if (periode_mois) { sql += ` AND fp.periode_mois=$${idx++}`; params.push(periode_mois); }
    if (periode_annee) { sql += ` AND fp.periode_annee=$${idx++}`; params.push(periode_annee); }
    sql += ` ORDER BY fp.periode_annee DESC, fp.periode_mois DESC, e.nom`;
    return this.db.query(sql, params);
  }

  async genererFichePaie(dto: any) {
    // Calculer automatiquement depuis les présences
    const employe = await this.db.query(`SELECT * FROM employes WHERE id=$1`, [dto.employe_id]);
    if (!employe.length) throw new NotFoundException('Employé introuvable');
    const e = employe[0];

    const presences = await this.db.query(`
      SELECT SUM(heures_travaillees) as total_h, SUM(heures_sup) as total_sup
      FROM presences
      WHERE employe_id=$1
        AND EXTRACT(MONTH FROM date_presence)=$2
        AND EXTRACT(YEAR FROM date_presence)=$3
    `, [dto.employe_id, dto.periode_mois, dto.periode_annee]);

    const congesPris = await this.db.query(`
      SELECT COALESCE(SUM(nb_jours),0) as jours
      FROM conges
      WHERE employe_id=$1 AND statut='APPROUVE'
        AND EXTRACT(MONTH FROM date_debut)=$2 AND EXTRACT(YEAR FROM date_debut)=$3
    `, [dto.employe_id, dto.periode_mois, dto.periode_annee]);

    const p = presences[0];
    const heures = parseFloat(p.total_h) || (e.nb_heures_semaine * 4.33);
    const heures_sup = parseFloat(p.total_sup) || 0;
    const salaire_brut = heures * parseFloat(e.taux_horaire) +
      heures_sup * parseFloat(e.taux_horaire) * 1.25 +
      (parseFloat(dto.primes) || 0);
    const charges = salaire_brut * (parseFloat(e.cout_charges_pct) / 100);
    const retenues = salaire_brut * 0.15; // charges salariales ~15%

    const res = await this.db.query(`
      INSERT INTO fiches_paie (employe_id, periode_mois, periode_annee,
        nb_heures_travaillees, nb_heures_sup, nb_jours_conge,
        salaire_brut, charges_patronales, primes, retenues, statut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'BROUILLON')
      ON CONFLICT (employe_id, periode_mois, periode_annee)
      DO UPDATE SET salaire_brut=$7, charges_patronales=$8, primes=$9, retenues=$10
      RETURNING *
    `, [dto.employe_id, dto.periode_mois, dto.periode_annee,
        heures.toFixed(2), heures_sup.toFixed(2),
        parseFloat(congesPris[0].jours).toFixed(2),
        salaire_brut.toFixed(2), charges.toFixed(2),
        (parseFloat(dto.primes) || 0).toFixed(2), retenues.toFixed(2)]);
    return res[0];
  }

  async validerFichePaie(id: string) {
    const res = await this.db.query(`
      UPDATE fiches_paie SET statut='VALIDEE', date_validation=NOW() WHERE id=$1 RETURNING *
    `, [id]);
    return res[0];
  }

  async getCoutMoMensuel() {
    return this.db.query(`
      SELECT
        fp.periode_annee, fp.periode_mois,
        ROUND(SUM(fp.cout_total_mo)::numeric,2) as cout_total,
        ROUND(SUM(fp.salaire_brut)::numeric,2) as masse_salariale,
        ROUND(SUM(fp.charges_patronales)::numeric,2) as charges,
        COUNT(fp.id) as nb_employes
      FROM fiches_paie fp
      WHERE fp.statut='VALIDEE'
      GROUP BY fp.periode_annee, fp.periode_mois
      ORDER BY fp.periode_annee DESC, fp.periode_mois DESC
      LIMIT 12
    `);
  }
}

// ── Controller ────────────────────────────────────────────────

@Controller('rh')
@UseGuards(AuthGuard('jwt'))
export class RhController {
  constructor(private readonly svc: RhService) {}

  @Get('dashboard')
  getDashboard() { return this.svc.getDashboardKpis(); }

  @Get('cout-mo-of')
  getCoutMoOf() { return this.svc.getCoutMoParOf(); }

  @Get('cout-mo-mensuel')
  getCoutMoMensuel() { return this.svc.getCoutMoMensuel(); }

  @Get('employes')
  getEmployes(@Query() q: any) { return this.svc.findAllEmployes(q); }

  @Get('employes/:id')
  getEmploye(@Param('id') id: string) { return this.svc.findOneEmploye(id); }

  @Post('employes')
  createEmploye(@Body() dto: CreateEmployeDto) { return this.svc.createEmploye(dto); }

  @Put('employes/:id')
  updateEmploye(@Param('id') id: string, @Body() dto: any) { return this.svc.updateEmploye(id, dto); }

  @Get('presences')
  getPresences(@Query() q: any) { return this.svc.getPresences(q); }

  @Post('presences')
  createPresence(@Body() dto: CreatePresenceDto) { return this.svc.createPresence(dto); }

  @Get('conges')
  getConges(@Query() q: any) { return this.svc.getConges(q); }

  @Post('conges')
  createConge(@Body() dto: CreateCongeDto) { return this.svc.createConge(dto); }

  @Put('conges/:id/approuver')
  approuverConge(@Param('id') id: string, @Body() body: { approuve: boolean; commentaire?: string }) {
    return this.svc.approuverConge(id, body.approuve, body.commentaire);
  }

  @Get('competences')
  getCompetences() { return this.svc.getCompetences(); }

  @Get('competences/matrice')
  getMatrice() { return this.svc.getMatriceCompetences(); }

  @Get('formations')
  getFormations(@Query() q: any) { return this.svc.getFormations(q); }

  @Get('fiches-paie')
  getFichesPaie(@Query() q: any) { return this.svc.getFichesPaie(q); }

  @Post('fiches-paie/generer')
  genererFiche(@Body() dto: CreateFichePaieDto) { return this.svc.genererFichePaie(dto); }

  @Put('fiches-paie/:id/valider')
  validerFiche(@Param('id') id: string) { return this.svc.validerFichePaie(id); }
}

// ── Module ────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [RhController],
  providers: [RhService],
  exports: [RhService],
})
export class RhModule {}
