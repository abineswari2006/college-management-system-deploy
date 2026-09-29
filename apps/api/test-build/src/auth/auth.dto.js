var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
export class LoginDto {
    email;
    password;
}
__decorate([
    IsEmail(),
    MaxLength(254),
    __metadata("design:type", String)
], LoginDto.prototype, "email", void 0);
__decorate([
    IsString(),
    MinLength(12),
    MaxLength(128),
    __metadata("design:type", String)
], LoginDto.prototype, "password", void 0);
export class ForgotPasswordDto {
    email;
}
__decorate([
    IsEmail(),
    MaxLength(254),
    __metadata("design:type", String)
], ForgotPasswordDto.prototype, "email", void 0);
export class ResetPasswordDto {
    token;
    password;
}
__decorate([
    IsString(),
    MinLength(40),
    MaxLength(128),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "token", void 0);
__decorate([
    IsString(),
    MinLength(12),
    MaxLength(128),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "password", void 0);
export class ChangePasswordDto {
    currentPassword;
    newPassword;
}
__decorate([
    IsString(),
    MinLength(12),
    MaxLength(128),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "currentPassword", void 0);
__decorate([
    IsString(),
    MinLength(12),
    MaxLength(128),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "newPassword", void 0);
