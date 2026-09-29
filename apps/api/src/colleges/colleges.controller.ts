import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor, RequirePermission, type AuthActor } from '../shared/security.js';
import { CreateCollegeDto, ListCollegesQuery, UpdateCollegeDto } from './colleges.dto.js';
import { CollegesService } from './colleges.service.js';

@ApiTags('colleges')
@Controller('colleges')
@RequirePermission('colleges.view')
export class CollegesController {
  constructor(@Inject(CollegesService) private readonly colleges: CollegesService) {}

  @Get()
  @ApiOperation({ summary: 'List colleges (Super Admin only)' })
  list(@Query() query: ListCollegesQuery) {
    return this.colleges.list(query);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.colleges.get(id);
  }

  @Post()
  @RequirePermission('colleges.create')
  create(@Body() dto: CreateCollegeDto, @CurrentActor() actor: AuthActor) {
    return this.colleges.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermission('colleges.update')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCollegeDto,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.colleges.update(id, dto, actor);
  }

  @Patch(':id/deactivate')
  @RequirePermission('colleges.deactivate')
  deactivate(@Param('id', new ParseUUIDPipe()) id: string, @CurrentActor() actor: AuthActor) {
    return this.colleges.deactivate(id, actor);
  }
}