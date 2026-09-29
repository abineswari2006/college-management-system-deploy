import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor, RequirePermission, type AuthActor } from '../shared/security.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('dashboard')
@Controller('dashboard')
@RequirePermission('dashboard.view')
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Read database-backed metrics for the current access scope' })
  summary(@CurrentActor() actor: AuthActor) {
    return this.dashboard.summary(actor);
  }
}