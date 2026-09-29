import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor, RequirePermission, type AuthActor } from '../shared/security.js';
import { CreateSystemAdminDto, CreateUserDto, ListUsersQuery, UpdateUserDto } from './users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
@RequirePermission('users.view')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users in the current college, or across colleges for Super Admin' })
  list(@CurrentActor() actor: AuthActor, @Query() query: ListUsersQuery) {
    return this.users.list(actor, query);
  }

  @Post()
  @RequirePermission('users.create')
  create(@Body() dto: CreateUserDto, @CurrentActor() actor: AuthActor) {
    return this.users.create(dto, actor);
  }

  @Post('system-admins')
  @RequirePermission('users.manage')
  createSystemAdmin(@Body() dto: CreateSystemAdminDto, @CurrentActor() actor: AuthActor) {
    return this.users.createSystemAdmin(dto, actor);
  }

  @Patch(':id')
  @RequirePermission('users.update')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Patch(':id/deactivate')
  @RequirePermission('users.deactivate')
  deactivate(@Param('id', new ParseUUIDPipe()) id: string, @CurrentActor() actor: AuthActor) {
    return this.users.deactivate(id, actor);
  }
}