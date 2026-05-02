import {
  Controller, Post, Body, Get, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, AuthResponseDto } from './dto/auth.dto';
import { JwtAuthGuard, JwtRefreshGuard } from './guards/auth.guard';
import { CurrentUser, JwtUser, Public } from './decorators/auth.decorators';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /auth/login ──────────────────────────────────────────────────────
  @Post('login')
  @Public()   // ← exclut du guard JWT global
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion — retourne access_token + refresh_token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Email ou mot de passe incorrect' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  // ── POST /auth/refresh ────────────────────────────────────────────────────
  @Post('refresh')
  @Public()   // ← le refresh token est validé par JwtRefreshGuard, pas le global
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: 'Renouveler l\'access token avec le refresh token' })
  @ApiResponse({ status: 200 })
  async refresh(@CurrentUser() user: JwtUser): Promise<{ accessToken: string }> {
    return this.authService.refresh(user.id);
  }

  // ── POST /auth/logout ─────────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Déconnexion' })
  logout(): { message: string } {
    return { message: 'Déconnexion réussie' };
  }

  // ── GET /auth/me ──────────────────────────────────────────────────────────
  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Profil de l\'utilisateur connecté' })
  getMe(@CurrentUser() user: JwtUser): JwtUser {
    return user;
  }
}
