import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, HttpCode, HttpStatus, ConflictException,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiResponse,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsEmail, IsEnum, IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Utilisateur } from '../database/entities/expedition.entity';
import { UserRole } from '../database/entities/enums';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../auth/decorators/auth.decorators';
import { AuthService } from '../auth/auth.service';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateUtilisateurDto {
  @ApiProperty({ example: 'jean.dupont@supply-chain.fr' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  nom: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  prenom: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ example: 'MotDePasse123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  siteId?: string;
}

export class UpdateUtilisateurDto {
  @ApiProperty({ enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  actif?: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class UtilisateursService {
  constructor(
    @InjectRepository(Utilisateur)
    private readonly repo: Repository<Utilisateur>,
    private readonly authService: AuthService,
  ) {}

  findAll(): Promise<Utilisateur[]> {
    return this.repo.find({
      select: ['id', 'email', 'nom', 'prenom', 'role', 'siteId', 'actif', 'lastLogin', 'createdAt'],
      order: { nom: 'ASC' },
    });
  }

  findOne(id: string): Promise<Utilisateur | null> {
    return this.repo.findOne({
      where: { id },
      select: ['id', 'email', 'nom', 'prenom', 'role', 'siteId', 'actif', 'lastLogin', 'createdAt'],
    });
  }

  async create(dto: CreateUtilisateurDto): Promise<Utilisateur> {
    const exists = await this.repo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (exists) {
      throw new ConflictException(`Un utilisateur avec l'email ${dto.email} existe déjà`);
    }

    const passwordHash = await this.authService.hashPassword(dto.password);
    const user = this.repo.create({
      email:    dto.email.toLowerCase(),
      nom:      dto.nom,
      prenom:   dto.prenom,
      role:     dto.role,
      siteId:   dto.siteId,
      ...({ passwordHash } as any),
    });

    return this.repo.save(user) as unknown as Promise<Utilisateur>;
  }

  async update(id: string, dto: UpdateUtilisateurDto): Promise<Utilisateur | null> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async desactiver(id: string): Promise<void> {
    await this.repo.update(id, { actif: false });
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('utilisateurs')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('utilisateurs')
export class UtilisateursController {
  constructor(private readonly service: UtilisateursService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Liste tous les utilisateurs (ADMIN uniquement)' })
  findAll() {
    return this.service.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Profil de l\'utilisateur connecté' })
  getMe(@CurrentUser() user: JwtUser) {
    return this.service.findOne(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Détail d\'un utilisateur (ADMIN uniquement)' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Créer un utilisateur (ADMIN uniquement)' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateUtilisateurDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier rôle/site/statut d\'un utilisateur (ADMIN uniquement)' })
  update(@Param('id') id: string, @Body() dto: UpdateUtilisateurDto) {
    return this.service.update(id, dto);
  }

  @Put(':id/desactiver')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Désactiver un utilisateur — soft delete (ADMIN uniquement)' })
  desactiver(@Param('id') id: string) {
    return this.service.desactiver(id);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [
    TypeOrmModule.forFeature([Utilisateur]),
    AuthModule,
  ],
  controllers: [UtilisateursController],
  providers: [UtilisateursService],
  exports: [UtilisateursService],
})
export class UtilisateursModule {}