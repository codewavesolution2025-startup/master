import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, UploadedFile, UseInterceptors, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Injectable } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../auth/decorators/auth.decorators';
import { UserRole } from '../database/entities/enums';

// Champs commercialement sensibles — jamais renvoyés au compte démo (LECTURE),
// même si le front-end les masque déjà : ceci empêche aussi un accès direct à l'API.
// (convention_url reste visible : la convention signée sert de preuve de traction pour le jury)
const SENSITIVE_FIELDS = ['mrr', 'nps', 'notes'] as const;
function stripSensitive<T extends Record<string, any>>(row: T): T {
  const clone = { ...row };
  for (const f of SENSITIVE_FIELDS) delete (clone as any)[f];
  return clone;
}
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Response } from 'express';
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

// ── DTO ───────────────────────────────────────────────────────
export class CreateDeploiementDto {
  @IsString() client_nom: string;
  @IsOptional() @IsString() client_secteur?: string;
  @IsOptional() @IsString() client_ville?: string;
  @IsOptional() @IsString() client_contact?: string;
  @IsOptional() @IsString() client_email?: string;
  @IsOptional() @IsString() client_tel?: string;
  @IsString() date_deploiement: string;
  @IsOptional() @IsString() statut?: string;
  @IsOptional() modules_actifs?: string[];
  @IsOptional() @IsNumber() nb_utilisateurs?: number;
  @IsOptional() @IsString() formule?: string;
  @IsOptional() @IsNumber() mrr?: number;
  @IsOptional() @IsNumber() nps?: number;
  @IsOptional() @IsString() notes?: string;
}

// ── Service ───────────────────────────────────────────────────
@Injectable()
export class DeploiementsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async findAll() {
    return this.db.query(`
      SELECT *,
        CASE
          WHEN statut = 'ACTIF' THEN 1
          WHEN statut = 'PILOTE' THEN 2
          WHEN statut = 'SUSPENDU' THEN 3
          ELSE 4
        END as sort_order
      FROM deploiements_clients
      ORDER BY sort_order, date_deploiement DESC
    `);
  }

  async getStats() {
    return this.db.query(`
      SELECT
        COUNT(*) as total_clients,
        COUNT(*) FILTER (WHERE statut='ACTIF') as actifs,
        COUNT(*) FILTER (WHERE statut='PILOTE') as pilotes,
        COUNT(*) FILTER (WHERE statut='SUSPENDU') as suspendus,
        ROUND(COALESCE(SUM(mrr),0)::numeric,2) as mrr_total,
        ROUND(COALESCE(AVG(nps) FILTER (WHERE nps IS NOT NULL),0)::numeric,1) as nps_moyen,
        SUM(nb_utilisateurs) as total_utilisateurs,
        COUNT(*) FILTER (WHERE convention_signee=true) as conventions_signees
      FROM deploiements_clients
    `);
  }

  async create(dto: CreateDeploiementDto) {
    const res = await this.db.query(`
      INSERT INTO deploiements_clients (
        client_nom, client_secteur, client_ville, client_contact,
        client_email, client_tel, date_deploiement, statut,
        modules_actifs, nb_utilisateurs, formule, mrr, nps, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      dto.client_nom, dto.client_secteur, dto.client_ville, dto.client_contact,
      dto.client_email, dto.client_tel, dto.date_deploiement, dto.statut || 'PILOTE',
      dto.modules_actifs || [], dto.nb_utilisateurs || 1,
      dto.formule || 'STARTER', dto.mrr || 0, dto.nps, dto.notes,
    ]);
    return res[0];
  }

  async update(id: string, dto: Partial<CreateDeploiementDto>) {
    const fields = Object.keys(dto).filter(k => dto[k as keyof typeof dto] !== undefined);
    if (!fields.length) return this.findOne(id);
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const vals = fields.map(f => dto[f as keyof typeof dto]);
    await this.db.query(
      `UPDATE deploiements_clients SET ${sets}, updated_at=NOW() WHERE id=$1`,
      [id, ...vals]
    );
    return this.findOne(id);
  }

  async findOne(id: string) {
    const res = await this.db.query(
      `SELECT * FROM deploiements_clients WHERE id=$1`, [id]
    );
    return res[0];
  }

  async uploadConvention(id: string, filename: string) {
    await this.db.query(`
      UPDATE deploiements_clients
      SET convention_url=$2, convention_signee=true, date_signature=NOW(), updated_at=NOW()
      WHERE id=$1
    `, [id, filename]);
    return this.findOne(id);
  }
}

// ── Controller ────────────────────────────────────────────────
@ApiTags('admin')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/deploiements')
export class DeploiementsController {
  constructor(private readonly svc: DeploiementsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste tous les déploiements clients' })
  async findAll(@CurrentUser() user: JwtUser) {
    const rows = await this.svc.findAll();
    return user.role === UserRole.LECTURE ? rows.map(stripSensitive) : rows;
  }

  @Get('stats')
  @ApiOperation({ summary: 'KPIs du portefeuille clients' })
  async getStats(@CurrentUser() user: JwtUser) {
    const rows = await this.svc.getStats();
    if (user.role !== UserRole.LECTURE) return rows;
    return rows.map((r: any) => {
      const { mrr_total, nps_moyen, ...rest } = r;
      return rest;
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const row = await this.svc.findOne(id);
    return row && user.role === UserRole.LECTURE ? stripSensitive(row) : row;
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateDeploiementDto) { return this.svc.create(dto); }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: Partial<CreateDeploiementDto>) {
    return this.svc.update(id, dto);
  }

  @Post(':id/convention')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'conventions');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `convention-${req.params.id}-${Date.now()}${extname(file.originalname)}`;
        cb(null, uniqueName);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') cb(null, true);
      else cb(new Error('Seuls les fichiers PDF sont acceptés'), false);
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  }))
  async uploadConvention(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.uploadConvention(id, file.filename);
  }

  @Get(':id/convention/download')
  async downloadConvention(@Param('id') id: string, @Res() res: Response) {
    const dep = await this.svc.findOne(id);
    if (!dep?.convention_url) {
      return res.status(404).json({ message: 'Aucune convention disponible' });
    }
    const filePath = join(process.cwd(), 'uploads', 'conventions', dep.convention_url);
    if (!existsSync(filePath)) {
      return res.status(404).json({ message: 'Fichier introuvable' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="convention-${dep.client_nom}.pdf"`);
    return res.sendFile(filePath);
  }
}

// ── Module ────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [DeploiementsController],
  providers: [DeploiementsService],
  exports: [DeploiementsService],
})
export class DeploiementsModule {}
