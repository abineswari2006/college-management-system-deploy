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
let DashboardService = class DashboardService {
    database;
    constructor(database) {
        this.database = database;
    }
    async summary(actor) {
        const scope = actor.collegeId ? 'college' : 'system';
        const collegeFilter = actor.collegeId ? 'AND m.college_id = $1' : '';
        const parameters = actor.collegeId ? [actor.collegeId] : [];
        const [colleges, users, invitations, activity] = await Promise.all([
            actor.collegeId
                ? this.database.query(`SELECT count(*) FILTER (WHERE status = 'active')::text AS active,
                    count(*) FILTER (WHERE status = 'deactivated')::text AS deactivated
             FROM colleges WHERE id = $1`, [actor.collegeId])
                : this.database.query(`SELECT count(*) FILTER (WHERE status = 'active')::text AS active,
                    count(*) FILTER (WHERE status = 'deactivated')::text AS deactivated
             FROM colleges`),
            this.database.query(`SELECT count(DISTINCT u.id)::text AS count FROM users u
         JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
         JOIN colleges c ON c.id = m.college_id AND c.status = 'active'
         WHERE u.status = 'active' ${collegeFilter}`, parameters),
            this.database.query(`SELECT count(DISTINCT u.id)::text AS count FROM users u
         JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
         JOIN colleges c ON c.id = m.college_id AND c.status = 'active'
         WHERE u.status = 'invited' ${collegeFilter}`, parameters),
            this.database.query(`SELECT a.id, a.action, a.entity_type, a.created_at,
                u.full_name AS actor_name, c.name AS college_name
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id
         LEFT JOIN colleges c ON c.id = a.college_id
         ${actor.collegeId ? 'WHERE a.college_id = $1' : ''}
         ORDER BY a.created_at DESC LIMIT 8`, parameters),
        ]);
        return {
            data: {
                scope: {
                    type: scope,
                    collegeId: actor.collegeId,
                    collegeName: actor.collegeName,
                },
                metrics: {
                    activeColleges: Number(colleges.rows[0]?.active ?? 0),
                    deactivatedColleges: Number(colleges.rows[0]?.deactivated ?? 0),
                    activeUsers: Number(users.rows[0]?.count ?? 0),
                    pendingInvitations: Number(invitations.rows[0]?.count ?? 0),
                },
                recentActivity: activity.rows.map((row) => ({
                    id: row.id,
                    action: row.action,
                    entityType: row.entity_type,
                    createdAt: row.created_at,
                    actorName: row.actor_name,
                    collegeName: row.college_name,
                })),
            },
        };
    }
};
DashboardService = __decorate([
    Injectable(),
    __param(0, Inject(DATABASE)),
    __metadata("design:paramtypes", [Object])
], DashboardService);
export { DashboardService };
