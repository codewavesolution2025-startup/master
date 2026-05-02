import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../../database/entities/enums';
import { ROLES_KEY } from '../guards/auth.guard';

// ── @Roles(...roles) ──────────────────────────────────────────────────────────
// Exemple : @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// ── @Public() — exclut la route du guard JWT ─────────────────────────────────
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// ── @CurrentUser() — injecte l'utilisateur depuis le JWT ─────────────────────
// Exemple : @CurrentUser() user: JwtUser
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// ── Type de l'utilisateur injecté par le guard JWT ───────────────────────────
export interface JwtUser {
  id: string;
  email: string;
  role: UserRole;
  siteId: string | null;
}
