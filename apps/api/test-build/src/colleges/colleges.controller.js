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
import { CreateCollegeDto, ListCollegesQuery, UpdateCollegeDto } from './colleges.dto.js';
import { CollegesService } from './colleges.service.js';
let CollegesController = class CollegesController {
    colleges;
    constructor(colleges) {
        this.colleges = colleges;
    }
    list(query) {
        return this.colleges.list(query);
    }
    get(id) {
        return this.colleges.get(id);
    }
    create(dto, actor) {
        return this.colleges.create(dto, actor);
    }
    update(id, dto, actor) {
        return this.colleges.update(id, dto, actor);
    }
    deactivate(id, actor) {
        return this.colleges.deactivate(id, actor);
    }
};
__decorate([
    Get(),
    ApiOperation({ summary: 'List colleges (Super Admin only)' }),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ListCollegesQuery]),
    __metadata("design:returntype", void 0)
], CollegesController.prototype, "list", null);
__decorate([
    Get(':id'),
    __param(0, Param('id', new ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CollegesController.prototype, "get", null);
__decorate([
    Post(),
    RequirePermission('colleges.create'),
    __param(0, Body()),
    __param(1, CurrentActor()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateCollegeDto, Object]),
    __metadata("design:returntype", void 0)
], CollegesController.prototype, "create", null);
__decorate([
    Patch(':id'),
    RequirePermission('colleges.update'),
    __param(0, Param('id', new ParseUUIDPipe())),
    __param(1, Body()),
    __param(2, CurrentActor()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateCollegeDto, Object]),
    __metadata("design:returntype", void 0)
], CollegesController.prototype, "update", null);
__decorate([
    Patch(':id/deactivate'),
    RequirePermission('colleges.deactivate'),
    __param(0, Param('id', new ParseUUIDPipe())),
    __param(1, CurrentActor()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CollegesController.prototype, "deactivate", null);
CollegesController = __decorate([
    ApiTags('colleges'),
    Controller('colleges'),
    RequirePermission('colleges.view'),
    __param(0, Inject(CollegesService)),
    __metadata("design:paramtypes", [CollegesService])
], CollegesController);
export { CollegesController };
