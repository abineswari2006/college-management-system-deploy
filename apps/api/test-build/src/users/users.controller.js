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
import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor, RequirePermission } from '../shared/security.js';
import { CreateSystemAdminDto, CreateUserDto, ListUsersQuery, UpdateUserDto } from './users.dto.js';
import { UsersService } from './users.service.js';
let UsersController = class UsersController {
    users;
    constructor(users) {
        this.users = users;
    }
    list(actor, query) {
        return this.users.list(actor, query);
    }
    create(dto, actor) {
        return this.users.create(dto, actor);
    }
    createSystemAdmin(dto, actor) {
        return this.users.createSystemAdmin(dto, actor);
    }
    update(id, dto, actor) {
        return this.users.update(id, dto, actor);
    }
    deactivate(id, actor) {
        return this.users.deactivate(id, actor);
    }
};
__decorate([
    Get(),
    ApiOperation({ summary: 'List users in the current college, or across colleges for Super Admin' }),
    __param(0, CurrentActor()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ListUsersQuery]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "list", null);
__decorate([
    Post(),
    RequirePermission('users.create'),
    __param(0, Body()),
    __param(1, CurrentActor()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateUserDto, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "create", null);
__decorate([
    Post('system-admins'),
    RequirePermission('users.manage'),
    __param(0, Body()),
    __param(1, CurrentActor()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateSystemAdminDto, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "createSystemAdmin", null);
__decorate([
    Patch(':id'),
    RequirePermission('users.update'),
    __param(0, Param('id', new ParseUUIDPipe())),
    __param(1, Body()),
    __param(2, CurrentActor()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateUserDto, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "update", null);
__decorate([
    Patch(':id/deactivate'),
    RequirePermission('users.deactivate'),
    __param(0, Param('id', new ParseUUIDPipe())),
    __param(1, CurrentActor()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "deactivate", null);
UsersController = __decorate([
    ApiTags('users'),
    Controller('users'),
    RequirePermission('users.view'),
    __param(0, Inject(UsersService)),
    __metadata("design:paramtypes", [UsersService])
], UsersController);
export { UsersController };
