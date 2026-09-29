var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
export const collegeRoles = [
    'college_admin',
    'principal',
    'hod',
    'faculty',
    'student',
    'parent',
    'accountant',
    'librarian',
    'hr_staff',
];
export class CreateUserDto {
    email;
    fullName;
    roleCode;
    collegeId;
}
__decorate([
    IsEmail(),
    MaxLength(254),
    __metadata("design:type", String)
], CreateUserDto.prototype, "email", void 0);
__decorate([
    IsString(),
    MinLength(2),
    MaxLength(120),
    __metadata("design:type", String)
], CreateUserDto.prototype, "fullName", void 0);
__decorate([
    IsIn(collegeRoles),
    __metadata("design:type", Object)
], CreateUserDto.prototype, "roleCode", void 0);
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "collegeId", void 0);
export class UpdateUserDto {
    fullName;
    roleCode;
}
__decorate([
    IsOptional(),
    IsString(),
    MinLength(2),
    MaxLength(120),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "fullName", void 0);
__decorate([
    IsOptional(),
    IsIn(collegeRoles),
    __metadata("design:type", Object)
], UpdateUserDto.prototype, "roleCode", void 0);
export class ListUsersQuery {
    page = 1;
    limit = 20;
    search;
    status;
}
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(1000000),
    __metadata("design:type", Object)
], ListUsersQuery.prototype, "page", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(100),
    __metadata("design:type", Object)
], ListUsersQuery.prototype, "limit", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    __metadata("design:type", String)
], ListUsersQuery.prototype, "search", void 0);
__decorate([
    IsOptional(),
    IsIn(['invited', 'active', 'deactivated']),
    __metadata("design:type", String)
], ListUsersQuery.prototype, "status", void 0);
export class CreateSystemAdminDto {
    email;
    fullName;
}
__decorate([
    IsEmail(),
    MaxLength(254),
    __metadata("design:type", String)
], CreateSystemAdminDto.prototype, "email", void 0);
__decorate([
    IsString(),
    MinLength(2),
    MaxLength(120),
    __metadata("design:type", String)
], CreateSystemAdminDto.prototype, "fullName", void 0);
