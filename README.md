# College Management System

Multi-tenant college administration platform. The current delivery is **Phase 1**: authentication, tenant-aware authorization, college and user administration, system settings, audit activity, and a database-backed dashboard. Academic, student, teaching, finance, library, and reporting modules are planned for later phases and are not represented as completed here.

## Stack

- Web: React 19, TypeScript, Vite, lucide-react
- API: NestJS 11, TypeScript, REST under `/api/v1`, OpenAPI at `/api/docs`
- Database: PostgreSQL 17 in deployment; embedded PGlite for zero-service local development
- Passwords: Argon2id
- Sessions: signed HttpOnly cookies backed by revocable PostgreSQL session records
- Validation: class-validator DTOs with whitelist and unknown-field rejection

## Local development

Requirements: Node.js 20 or newer and npm. Docker is optional.

```powershell
npm install
npm run db:seed
npm run dev
```

The seed initializes the local PGlite database at `apps/api/.pglite`, applies migrations, and creates two example colleges and development accounts. Start the app at `http://localhost:5173`; the API is at `http://localhost:4000`, and API docs are at `http://localhost:4000/api/docs`.

Development credentials (all seeded accounts use the same local-only password):

- Super Admin: `admin@college.test`
- Northfield College Admin: `admin.north@campus.demo`
- Lakeside Institute Admin: `admin.lakeside@campus.demo`
- Password: `Admin@12345`
- Other Northfield role accounts: `hod.north@campus.demo`, `faculty.north@campus.demo`, `student.north@campus.demo`, `parent.north@campus.demo`, `accountant.north@campus.demo`, `librarian.north@campus.demo`

These seeded credentials are public development fixtures, not production credentials. The seed command refuses to run when `NODE_ENV=production`. Do not expose a development database or reuse the demo password. Set `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` to override the local seed values.

To use a local PostgreSQL service instead of embedded development storage, start the `postgres` service in `docker-compose.yml`, then configure `DATABASE_URL=postgresql://cms_local:cms_local_dev_only@localhost:5432/college_management` in `apps/api/.env`. Copy `apps/api/.env.example` to `apps/api/.env` to configure email or other environment values. Run `npm run db:migrate` before starting the API.

## Tenant and authorization model

College memberships bind a user to a college and role. Each tenant-specific query derives its college scope from the authenticated membership resolved by the API. A client-supplied `X-College-Id` can select a scope only if the authenticated user has membership there; it never grants access. College Admin cannot list or manage another college. The Super Admin system role is the only cross-college role. Student/parent record-level and HOD/faculty assignment-level policies are reserved for the phases that introduce those domain records.

The initial migrations create colleges, users, memberships, roles, permissions, sessions, password-reset tokens, audit logs, and system settings, with foreign keys, indexes, uniqueness constraints, and soft-deactivation fields. All application SQL uses bound parameters except versioned migration scripts.

## Verification

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

The API integration suite boots Nest against embedded PostgreSQL and tests login/logout, CSRF enforcement, Super Admin cross-college access, College Admin isolation, validation of tenant override attempts, and college management.

## Deployment configuration

Production requires `DATABASE_URL`, a unique `SESSION_SECRET` of at least 32 random bytes, `WEB_ORIGIN`, `SMTP_URL`, and `MAIL_FROM`. Use HTTPS, a managed PostgreSQL service with backups, and a trusted reverse proxy; set `TRUST_PROXY_HOPS` only to the known proxy count. Apply migrations with `npm run db:migrate`, build with `npm run build`, and run the API with `npm run start --workspace=@college/api`; serve `apps/web/dist` from a static host configured to route application paths to `index.html`. Never use PGlite, the development seed, or example credentials in production.

Phase 1 does not yet include production email provider setup, payment processing, file storage, or later college operation modules.