var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
        imports: [DatabaseModule, AuthModule, CollegesModule, UsersModule, DashboardModule, SettingsModule],
        controllers: [HealthController],
        providers: [
            { provide: APP_GUARD, useClass: CsrfGuard },
            { provide: APP_GUARD, useClass: AuthenticationGuard },
            { provide: APP_GUARD, useClass: RateLimitGuard },
            { provide: APP_GUARD, useClass: MaintenanceModeGuard },
        ],
    })
], AppModule);
export { AppModule };
