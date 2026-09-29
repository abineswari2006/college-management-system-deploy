var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
export class CreateCollegeDto {
    name;
    code;
    timezone;
    locale;
    currency;
}
__decorate([
    IsString(),
    MinLength(2),
    MaxLength(120),
    __metadata("design:type", String)
], CreateCollegeDto.prototype, "name", void 0);
__decorate([
    IsString(),
    Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/),
    Transform(({ value }) => typeof value === 'string' ? value.toUpperCase() : value),
    __metadata("design:type", String)
], CreateCollegeDto.prototype, "code", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(64),
    __metadata("design:type", String)
], CreateCollegeDto.prototype, "timezone", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(16),
    __metadata("design:type", String)
], CreateCollegeDto.prototype, "locale", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Matches(/^[A-Za-z]{3}$/),
    Transform(({ value }) => typeof value === 'string' ? value.toUpperCase() : value),
    __metadata("design:type", String)
], CreateCollegeDto.prototype, "currency", void 0);
export class UpdateCollegeDto {
    name;
    code;
    timezone;
    locale;
    currency;
}
__decorate([
    IsOptional(),
    IsString(),
    MinLength(2),
    MaxLength(120),
    __metadata("design:type", String)
], UpdateCollegeDto.prototype, "name", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/),
    Transform(({ value }) => typeof value === 'string' ? value.toUpperCase() : value),
    __metadata("design:type", String)
], UpdateCollegeDto.prototype, "code", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(64),
    __metadata("design:type", String)
], UpdateCollegeDto.prototype, "timezone", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(16),
    __metadata("design:type", String)
], UpdateCollegeDto.prototype, "locale", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Matches(/^[A-Za-z]{3}$/),
    Transform(({ value }) => typeof value === 'string' ? value.toUpperCase() : value),
    __metadata("design:type", String)
], UpdateCollegeDto.prototype, "currency", void 0);
export class ListCollegesQuery {
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
], ListCollegesQuery.prototype, "page", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(100),
    __metadata("design:type", Object)
], ListCollegesQuery.prototype, "limit", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    __metadata("design:type", String)
], ListCollegesQuery.prototype, "search", void 0);
__decorate([
    IsOptional(),
    IsIn(['active', 'deactivated']),
    __metadata("design:type", String)
], ListCollegesQuery.prototype, "status", void 0);
