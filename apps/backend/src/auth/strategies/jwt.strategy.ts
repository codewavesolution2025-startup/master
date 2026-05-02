import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Utilisateur } from '../../database/entities/expedition.entity';

export interface JwtPayload {
  sub: string;       // user UUID
  email: string;
  role: string;
  siteId: string | null;
  type: 'access' | 'refresh';
}

// ── Stratégie Access Token ────────────────────────────────────────────────────
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(Utilisateur)
    private readonly utilisateurRepo: Repository<Utilisateur>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token invalide');
    }

    const user = await this.utilisateurRepo.findOne({
      where: { id: payload.sub, actif: true },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable ou désactivé');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      siteId: user.siteId,
    };
  }
}

// ── Stratégie Refresh Token ───────────────────────────────────────────────────
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService,
    @InjectRepository(Utilisateur)
    private readonly utilisateurRepo: Repository<Utilisateur>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_REFRESH_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token invalide');
    }

    const user = await this.utilisateurRepo.findOne({
      where: { id: payload.sub, actif: true },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    return { id: user.id, email: user.email, role: user.role, siteId: user.siteId };
  }
}
