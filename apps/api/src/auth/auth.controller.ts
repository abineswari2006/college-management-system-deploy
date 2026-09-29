import { randomBytes } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentActor, Public, type AuthActor, type AuthenticatedRequest } from '../shared/security.js';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, ResetPasswordDto } from './auth.dto.js';

const sessionCookie = 'cms_session';
const csrfCookie = 'cms_csrf';
const secureCookie = process.env.NODE_ENV === 'production';
const cookieOptions = { secure: secureCookie, sameSite: 'strict' as const, path: '/' };

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get('csrf')
  @Public()
  @ApiOperation({ summary: 'Issue a CSRF token for browser requests' })
  getCsrfToken(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const existing = request.cookies?.[csrfCookie];
    const token = typeof existing === 'string' && /^[A-Za-z0-9_-]{43}$/.test(existing)
      ? existing
      : randomBytes(32).toString('base64url');
    response.cookie(csrfCookie, token, { ...cookieOptions, httpOnly: false, maxAge: 30 * 60 * 1000 });
    return { data: { token } };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create an authenticated session' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password, request.get('user-agent'));
    response.cookie(sessionCookie, result.token, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: result.expiresAt.getTime() - Date.now(),
    });
    return {
      data: {
        user: result.user,
        memberships: result.memberships,
        isSuperAdmin: result.isSuperAdmin,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentActor() actor: AuthActor,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(actor);
    response.clearCookie(sessionCookie, cookieOptions);
    return { data: { signedOut: true } };
  }

  @Get('me')
  currentUser(@Req() request: AuthenticatedRequest) {
    const actor = request.actor!;
    return {
      data: {
        user: { id: actor.userId, email: actor.email, fullName: actor.fullName },
        role: { code: actor.roleCode, name: actor.roleName },
        college: actor.collegeId
          ? { id: actor.collegeId, name: actor.collegeName }
          : null,
        memberships: actor.memberships,
        permissions: actor.permissions,
        isSuperAdmin: actor.isSuperAdmin,
      },
    };
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return { data: { message: 'If the account exists, password reset instructions will be sent.' } };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { data: { passwordReset: true } };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentActor() actor: AuthActor, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(actor, dto);
    return { data: { passwordChanged: true } };
  }
}