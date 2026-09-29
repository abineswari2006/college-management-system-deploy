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
import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DATABASE } from '../db/database.js';
import { writeAudit } from '../shared/audit.js';
const selectColumns = `id, name, code, status, timezone, locale, currency, created_at, updated_at`;
let CollegesService = class CollegesService {
    database;
    constructor(database) {
        this.database = database;
    }
    async list(query) {
        const clauses = [];
        const values = [];
        if (query.status) {
            values.push(query.status);
            clauses.push(`status = $${values.length}`);
        }
        if (query.search?.trim()) {
            values.push(`%${query.search.trim()}%`);
            clauses.push(`(name ILIKE $${values.length} OR code ILIKE $${values.length})`);
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const count = await this.database.query(`SELECT count(*)::text AS count FROM colleges ${where}`, values);
        values.push(query.limit, (query.page - 1) * query.limit);
        const rows = await this.database.query(`SELECT ${selectColumns} FROM colleges ${where}
       ORDER BY created_at DESC, id ASC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
        return {
            data: rows.rows.map(toCollege),
            pagination: { page: query.page, limit: query.limit, total: Number(count.rows[0]?.count ?? 0) },
        };
    }
    async get(id) {
        const result = await this.database.query(`SELECT ${selectColumns} FROM colleges WHERE id = $1`, [id]);
        if (!result.rows[0])
            throw new NotFoundException('College not found.');
        return { data: toCollege(result.rows[0]) };
    }
    async create(dto, actor) {
        const id = randomUUID();
        try {
            const result = await this.database.transaction(async (executor) => {
                const inserted = await executor.query(`INSERT INTO colleges (id, name, code, timezone, locale, currency)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING ${selectColumns}`, [id, dto.name.trim(), dto.code.toUpperCase(), dto.timezone ?? 'UTC', dto.locale ?? 'en', (dto.currency ?? 'USD').toUpperCase()]);
                await writeAudit(executor, actor, 'college.created', 'college', id, null, { code: dto.code.toUpperCase() });
                return inserted.rows[0];
            });
            return { data: toCollege(result) };
        }
        catch (error) {
            if (isUniqueViolation(error))
                throw new ConflictException('A college with this code already exists.');
            throw error;
        }
    }
    async update(id, dto, actor) {
        const fields = [
            ['name', 'name'],
            ['code', 'code'],
            ['timezone', 'timezone'],
            ['locale', 'locale'],
            ['currency', 'currency'],
        ];
        const updates = fields.filter(([key]) => dto[key] !== undefined);
        if (updates.length === 0)
            throw new ConflictException('Provide at least one field to update.');
        const values = [id];
        const setClauses = updates.map(([key, column]) => {
            let value = dto[key];
            if (key === 'name' && typeof value === 'string')
                value = value.trim();
            if ((key === 'code' || key === 'currency') && typeof value === 'string')
                value = value.toUpperCase();
            values.push(value);
            return `${column} = $${values.length}`;
        });
        setClauses.push('updated_at = now()');
        try {
            return await this.database.transaction(async (executor) => {
                const result = await executor.query(`UPDATE colleges SET ${setClauses.join(', ')} WHERE id = $1 RETURNING ${selectColumns}`, values);
                if (!result.rows[0])
                    throw new NotFoundException('College not found.');
                await writeAudit(executor, actor, 'college.updated', 'college', id, null, { fields: updates.map(([key]) => key) });
                return { data: toCollege(result.rows[0]) };
            });
        }
        catch (error) {
            if (isUniqueViolation(error))
                throw new ConflictException('A college with this code already exists.');
            throw error;
        }
    }
    async deactivate(id, actor) {
        return this.database.transaction(async (executor) => {
            const result = await executor.query(`UPDATE colleges SET status = 'deactivated', deactivated_at = now(), updated_at = now()
         WHERE id = $1 AND status <> 'deactivated' RETURNING ${selectColumns}`, [id]);
            if (!result.rows[0]) {
                const exists = await executor.query('SELECT id FROM colleges WHERE id = $1', [id]);
                if (!exists.rows[0])
                    throw new NotFoundException('College not found.');
                return { data: { id, status: 'deactivated' } };
            }
            await writeAudit(executor, actor, 'college.deactivated', 'college', id, null);
            await executor.query(`UPDATE memberships SET status = 'deactivated', updated_at = now()
         WHERE college_id = $1 AND status = 'active'`, [id]);
            await executor.query(`UPDATE auth_sessions s SET revoked_at = now()
         WHERE s.revoked_at IS NULL
           AND EXISTS (
             SELECT 1 FROM memberships m
             WHERE m.user_id = s.user_id AND m.college_id = $1 AND m.status = 'deactivated'
           )
           AND NOT EXISTS (
             SELECT 1 FROM memberships m
             LEFT JOIN colleges c ON c.id = m.college_id
             WHERE m.user_id = s.user_id AND m.status = 'active'
               AND (m.college_id IS NULL OR c.status = 'active')
           )`, [id]);
            return { data: toCollege(result.rows[0]) };
        });
    }
};
CollegesService = __decorate([
    Injectable(),
    __param(0, Inject(DATABASE)),
    __metadata("design:paramtypes", [Object])
], CollegesService);
export { CollegesService };
function toCollege(row) {
    return {
        id: row.id,
        name: row.name,
        code: row.code,
        status: row.status,
        timezone: row.timezone,
        locale: row.locale,
        currency: row.currency.trim(),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function isUniqueViolation(error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
