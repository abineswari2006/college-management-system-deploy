import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CollegesModule } from './colleges/colleges.module.js';
import { UsersModule } from './users/users.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { HealthController } from './health.controller.js';
import { AuthenticationGuard, CsrfGuard, MaintenanceModeGuard, RateLimitGuard } from './shared/security.js';

@Module({
  imports: [DatabaseModule, AuthModule, CollegesModule, UsersModule, DashboardModule, SettingsModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: MaintenanceModeGuard },
  ],
})
export class AppModule {}