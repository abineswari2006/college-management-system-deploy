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
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../db/database.js';
import { writeAudit } from '../shared/audit.js';
import { clearMaintenanceModeCache } from '../shared/security.js';
let SettingsService = class SettingsService {
    database;
    constructor(database) {
        this.database = database;
    }
    async get() {
        const result = await this.database.query(`SELECT key, value, updated_at FROM system_settings
       WHERE key IN ('platform_name', 'support_email', 'maintenance_mode')
       ORDER BY key`);
        const values = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
        return {
            data: {
                platformName: values.platform_name ?? 'College Management',
                supportEmail: values.support_email ?? '',
                maintenanceMode: values.maintenance_mode ?? false,
                updatedAt: result.rows.reduce((latest, row) => !latest || row.updated_at > latest ? row.updated_at : latest, null),
            },
        };
    }
    async update(dto, actor) {
        const fields = [
            ['platformName', 'platform_name'],
            ['supportEmail', 'support_email'],
            ['maintenanceMode', 'maintenance_mode'],
        ];
        const entries = fields.filter(([property]) => dto[property] !== undefined);
        if (entries.length === 0)
            return this.get();
        await this.database.transaction(async (executor) => {
            for (const [property, key] of entries) {
                const value = dto[property];
                await executor.query(`INSERT INTO system_settings (key, value, updated_at)
           VALUES ($1, $2::jsonb, now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [key, JSON.stringify(value)]);
            }
            await writeAudit(executor, actor, 'settings.updated', 'system_settings', null, null, {
                keys: entries.map(([, key]) => key),
            });
        });
        if (entries.some(([, key]) => key === 'maintenance_mode'))
            clearMaintenanceModeCache();
        return this.get();
    }
};
SettingsService = __decorate([
    Injectable(),
    __param(0, Inject(DATABASE)),
    __metadata("design:paramtypes", [Object])
], SettingsService);
export { SettingsService };
