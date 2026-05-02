import {
  Injectable, UnauthorizedException, ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Utilisateur } from '../database/entities/expedition.entity';
import { LoginDto, AuthResponseDto } from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Utilisateur)
    private readonly utilisateurRepo: Repository<Utilisateur>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Login ─────────────────────────────────────────────────────────────────
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.utilisateurRepo.findOne({
      where: { email: dto.email.toLowerCase(), actif: true },
      select: ['id', 'email', 'nom', 'prenom', 'role', 'siteId'],
    });

    if (!user) {
      // Message générique pour ne pas révéler si l'email existe
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Récupérer le hash séparément (non sélectionné par défaut)
    const userWithHash = await this.utilisateurRepo
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where('u.id = :id', { id: user.id })
      .getOne();

    const passwordValid = await bcrypt.compare(
      dto.password,
      (userWithHash as any)?.passwordHash || '',
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Mettre à jour last_login
    await this.utilisateurRepo.update(user.id, { lastLogin: new Date() });

    return this.generateTokens(user);
  }

  // ── Refresh ───────────────────────────────────────────────────────────────
  async refresh(userId: string): Promise<{ accessToken: string }> {
    const user = await this.utilisateurRepo.findOne({
      where: { id: userId, actif: true },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    const accessToken = this.signAccessToken(user);
    return { accessToken };
  }

  // ── Générer les deux tokens ───────────────────────────────────────────────
  private generateTokens(user: Utilisateur): AuthResponseDto {
    const accessToken  = this.signAccessToken(user);
    const refreshToken = this.signRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      user: {
        id:     user.id,
        email:  user.email,
        nom:    user.nom,
        prenom: user.prenom,
        role:   user.role,
      },
    };
  }

  private signAccessToken(user: Utilisateur): string {
    const payload: JwtPayload = {
      sub:    user.id,
      email:  user.email,
      role:   user.role,
      siteId: user.siteId,
      type:   'access',
    };
    return this.jwtService.sign(payload, {
      secret:    this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRY', '15m'),
    });
  }

  private signRefreshToken(user: Utilisateur): string {
    const payload: JwtPayload = {
      sub:    user.id,
      email:  user.email,
      role:   user.role,
      siteId: user.siteId,
      type:   'refresh',
    };
    return this.jwtService.sign(payload, {
      secret:    this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRY', '7d'),
    });
  }

  // ── Hash mot de passe (utilisé à la création d'un utilisateur) ───────────
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
