import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor, RequirePermission, type AuthActor } from '../shared/security.js';
import { UpdateSettingsDto } from './settings.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('settings')
@Controller('settings')
@RequirePermission('settings.manage')
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Read system-level settings (Super Admin only)' })
  get() {
    return this.settings.get();
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto, @CurrentActor() actor: AuthActor) {
    return this.settings.update(dto, actor);
  }
}