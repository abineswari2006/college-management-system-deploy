import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type SqlDatabase } from '../db/database.js';
import { writeAudit } from '../shared/audit.js';
import { clearMaintenanceModeCache } from '../shared/security.js';
import type { AuthActor } from '../shared/security.js';
import type { UpdateSettingsDto } from './settings.dto.js';

@Injectable()
export class SettingsService {
  constructor(@Inject(DATABASE) private readonly database: SqlDatabase) {}

  async get() {
    const result = await this.database.query<{
      key: string;
      value: unknown;
      updated_at: Date;
    }>(
      `SELECT key, value, updated_at FROM system_settings
       WHERE key IN ('platform_name', 'support_email', 'maintenance_mode')
       ORDER BY key`,
    );
    const values = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
    return {
      data: {
        platformName: values.platform_name ?? 'College Management',
        supportEmail: values.support_email ?? '',
        maintenanceMode: values.maintenance_mode ?? false,
        updatedAt: result.rows.reduce<Date | null>(
          (latest, row) => !latest || row.updated_at > latest ? row.updated_at : latest,
          null,
        ),
      },
    };
  }

  async update(dto: UpdateSettingsDto, actor: AuthActor) {
    const fields: Array<[keyof UpdateSettingsDto, string]> = [
      ['platformName', 'platform_name'],
      ['supportEmail', 'support_email'],
      ['maintenanceMode', 'maintenance_mode'],
    ];
    const entries = fields.filter(([property]) => dto[property] !== undefined);
    if (entries.length === 0) return this.get();

    await this.database.transaction(async (executor) => {
      for (const [property, key] of entries) {
        const value = dto[property];
        await executor.query(
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES ($1, $2::jsonb, now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [key, JSON.stringify(value)],
        );
      }
      await writeAudit(executor, actor, 'settings.updated', 'system_settings', null, null, {
        keys: entries.map(([, key]) => key),
      });
    });
    if (entries.some(([, key]) => key === 'maintenance_mode')) clearMaintenanceModeCache();
    return this.get();
  }
}