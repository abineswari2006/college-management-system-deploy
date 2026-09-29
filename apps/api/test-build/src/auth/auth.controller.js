var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { randomBytes } from 'node:crypto';
import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res, } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor, Public } from '../shared/security.js';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, ResetPasswordDto } from './auth.dto.js';
const sessionCookie = 'cms_session';
const csrfCookie = 'cms_csrf';
const secureCookie = process.env.NODE_ENV === 'production';
const cookieOptions = { secure: secureCookie, sameSite: 'strict', path: '/' };
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    getCsrfToken(request, response) {
        const existing = request.cookies?.[csrfCookie];
        const token = typeof existing === 'string' && /^[A-Za-z0-9_-]{43}$/.test(existing)
            ? existing
            : randomBytes(32).toString('base64url');
        response.cookie(csrfCookie, token, { ...cookieOptions, httpOnly: false, maxAge: 30 * 60 * 1000 });
        return { data: { token } };
    }
    async login(dto, request, response) {
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
    async logout(actor, response) {
        await this.authService.logout(actor);
        response.clearCookie(sessionCookie, cookieOptions);
        return { data: { signedOut: true } };
    }
    currentUser(request) {
        const actor = request.actor;
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
    async forgotPassword(dto) {
        await this.authService.requestPasswordReset(dto.email);
        return { data: { message: 'If the account exists, password reset instructions will be sent.' } };
    }
    async resetPassword(dto) {
        await this.authService.resetPassword(dto);
        return { data: { passwordReset: true } };
    }
    async changePassword(actor, dto) {
        await this.authService.changePassword(actor, dto);
        return { data: { passwordChanged: true } };
    }
};
__decorate([
    Get('csrf'),
    Public(),
    ApiOperation({ summary: 'Issue a CSRF token for browser requests' }),
    __param(0, Req()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getCsrfToken", null);
__decorate([
    Post('login'),
    Public(),
    HttpCode(HttpStatus.OK),
    ApiOperation({ summary: 'Create an authenticated session' }),
    __param(0, Body()),
    __param(1, Req()),
    __param(2, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LoginDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    Post('logout'),
    HttpCode(HttpStatus.OK),
    __param(0, CurrentActor()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    Get('me'),
    __param(0, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "currentUser", null);
__decorate([
    Post('forgot-password'),
    Public(),
    HttpCode(HttpStatus.OK),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ForgotPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    Post('reset-password'),
    Public(),
    HttpCode(HttpStatus.OK),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ResetPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    Post('change-password'),
    HttpCode(HttpStatus.OK),
    __param(0, CurrentActor()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
AuthController = __decorate([
    ApiTags('authentication'),
    Controller('auth'),
    __param(0, Inject(AuthService)),
    __metadata("design:paramtypes", [AuthService])
], AuthController);
export { AuthController };
