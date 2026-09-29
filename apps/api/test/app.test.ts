import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { Test } from '@nestjs/testing';
import { PGlite } from '@electric-sql/pglite';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApiApp } from '../src/configure-app.js';
import { DATABASE, wrapPGlite, type SqlDatabase } from '../src/db/database.js';
import { migrateDatabase } from '../src/db/migrate.js';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-only-session-secret-32-bytes-minimum';

const password = 'Test-Password-For-College-2026!';
let database: SqlDatabase;
let moduleRef: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
let app: Awaited<ReturnType<typeof moduleRef.createNestApplication>>;
let collegeA: string;
let collegeB: string;
let adminA: string;
let adminB: string;
let sharedUser: string;

async function issueCsrf() {
  const response = await request(app.getHttpServer()).get('/api/v1/auth/csrf').expect(200);
  const cookie = responseCookies(response)[0].split(';')[0];
  return { token: response.body.data.token as string, cookie };
}

async function signIn(email: string) {
  await database.query('DELETE FROM auth_rate_limits');
  const csrf = await issueCsrf();
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('Cookie', csrf.cookie)
    .set('X-CSRF-Token', csrf.token)
    .send({ email, password })
    .expect(200);
  const sessionCookie = responseCookies(response)
    .map((cookie) => cookie.split(';')[0])
    .find((cookie) => cookie.startsWith('cms_session='));
  assert.ok(sessionCookie);
  return { cookie: `${csrf.cookie}; ${sessionCookie}`, csrfToken: csrf.token };
}

function responseCookies(response: request.Response) {
  const header = response.headers['set-cookie'];
  return Array.isArray(header) ? header : header ? [header] : [];
}

function postWithCsrf(path: string, session: { cookie: string; csrfToken: string }) {
  return request(app.getHttpServer())
    .post(path)
    .set('Cookie', session.cookie)
    .set('X-CSRF-Token', session.csrfToken);
}

before(async () => {
  const client = new PGlite();
  await client.waitReady;
  database = wrapPGlite(client);
  await migrateDatabase(database);

  collegeA = randomUUID();
  collegeB = randomUUID();
  const superAdminId = randomUUID();
  adminA = randomUUID();
  adminB = randomUUID();
  sharedUser = randomUUID();
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await database.transaction(async (executor) => {
    await executor.query(
      `INSERT INTO colleges (id, name, code) VALUES ($1, 'North College', 'NORTH'), ($2, 'South College', 'SOUTH')`,
      [collegeA, collegeB],
    );
    await executor.query(
      `INSERT INTO users (id, email, full_name, password_hash, status) VALUES
        ($1, 'root@campus.test', 'Platform Admin', $5, 'active'),
        ($2, 'admin-a@campus.test', 'Admin A', $5, 'active'),
        ($3, 'admin-b@campus.test', 'Admin B', $5, 'active'),
        ($4, 'shared@campus.test', 'Shared Admin', $5, 'active')`,
            [superAdminId, adminA, adminB, sharedUser, passwordHash],
    );
    await executor.query(
      `INSERT INTO memberships (id, user_id, college_id, role_code) VALUES
       ($1, $2, NULL, 'super_admin'), ($3, $4, $5, 'college_admin'),
       ($6, $7, $8, 'college_admin'), ($9, $10, $11, 'college_admin'),
       ($12, $10, $13, 'college_admin')`,
      [randomUUID(), superAdminId, randomUUID(), adminA, collegeA, randomUUID(), adminB, collegeB,
        randomUUID(), sharedUser, collegeA, randomUUID(), collegeB],
    );
  });

  moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DATABASE)
    .useValue(database)
    .compile();
  app = moduleRef.createNestApplication();
  configureApiApp(app);
  await app.init();
});

after(async () => {
  await app?.close();
  await database?.close();
});

test('health endpoint is public', async () => {
  const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  assert.deepEqual(response.body.data, { status: 'ok' });
});

test('login creates an HttpOnly session and supports logout revocation', async () => {
  const session = await signIn('admin-a@campus.test');
  const current = await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Cookie', session.cookie)
    .set('X-College-Id', collegeA)
    .expect(200);
  assert.equal(current.body.data.user.email, 'admin-a@campus.test');
  assert.equal(current.body.data.college.id, collegeA);

  await request(app.getHttpServer())
    .post('/api/v1/auth/logout')
    .set('Cookie', session.cookie)
    .set('X-CSRF-Token', session.csrfToken)
    .set('X-College-Id', collegeA)
    .expect(200);
  await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Cookie', session.cookie)
    .set('X-College-Id', collegeA)
    .expect(401);
});

test('unsafe requests require a matching CSRF token', async () => {
  await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'a@b.test', password }).expect(403);
});

test('Super Admin can create a college and access both tenant scopes', async () => {
  const session = await signIn('root@campus.test');
  const created = await postWithCsrf('/api/v1/colleges', session)
    .send({ name: 'West College', code: 'WEST' })
    .expect(201);
  assert.equal(created.body.data.code, 'WEST');

  const acrossColleges = await request(app.getHttpServer())
    .get('/api/v1/users')
    .set('Cookie', session.cookie)
    .expect(200);
  assert.ok(acrossColleges.body.data.some((user: { email: string }) => user.email === 'admin-a@campus.test'));

  const selectedTenant = await request(app.getHttpServer())
    .get('/api/v1/dashboard/summary')
    .set('Cookie', session.cookie)
    .set('X-College-Id', collegeB)
    .expect(200);
  assert.equal(selectedTenant.body.data.scope.collegeId, collegeB);
});

test('College Admin cannot cross tenant boundaries or manage colleges', async () => {
  const session = await signIn('admin-a@campus.test');
  await request(app.getHttpServer())
    .get('/api/v1/dashboard/summary')
    .set('Cookie', session.cookie)
    .set('X-College-Id', collegeB)
    .expect(403);
  await request(app.getHttpServer())
    .get('/api/v1/colleges')
    .set('Cookie', session.cookie)
    .set('X-College-Id', collegeA)
    .expect(403);

  const ownUsers = await request(app.getHttpServer())
    .get('/api/v1/users')
    .set('Cookie', session.cookie)
    .set('X-College-Id', collegeA)
    .expect(200);
  assert.ok(ownUsers.body.data.every((user: { college: { id: string } }) => user.college.id === collegeA));

  await request(app.getHttpServer())
    .get(`/api/v1/users?collegeId=${collegeB}`)
    .set('Cookie', session.cookie)
    .set('X-College-Id', collegeA)
    .expect(400);

  await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Cookie', session.cookie)
    .set('X-CSRF-Token', session.csrfToken)
    .set('X-College-Id', collegeA)
    .send({ email: 'intruder@campus.test', fullName: 'Intruder', roleCode: 'faculty', collegeId: collegeB })
    .expect(403);

  await request(app.getHttpServer())
    .patch(`/api/v1/users/${adminB}/deactivate`)
    .set('Cookie', session.cookie)
    .set('X-CSRF-Token', session.csrfToken)
    .set('X-College-Id', collegeA)
    .expect(404);
});

test('system settings are Super Admin only and maintenance mode blocks college users', async () => {
  const superAdmin = await signIn('root@campus.test');
  const collegeAdmin = await signIn('admin-a@campus.test');
  await request(app.getHttpServer())
    .get('/api/v1/settings')
    .set('Cookie', collegeAdmin.cookie)
    .set('X-College-Id', collegeA)
    .expect(403);

  await request(app.getHttpServer())
    .patch('/api/v1/settings')
    .set('Cookie', superAdmin.cookie)
    .set('X-CSRF-Token', superAdmin.csrfToken)
    .send({ maintenanceMode: true })
    .expect(200);
  await request(app.getHttpServer())
    .get('/api/v1/dashboard/summary')
    .set('Cookie', collegeAdmin.cookie)
    .set('X-College-Id', collegeA)
    .expect(503);
  await request(app.getHttpServer())
    .get('/api/v1/dashboard/summary')
    .set('Cookie', superAdmin.cookie)
    .expect(200);

  await request(app.getHttpServer())
    .patch('/api/v1/settings')
    .set('Cookie', superAdmin.cookie)
    .set('X-CSRF-Token', superAdmin.csrfToken)
    .send({ maintenanceMode: false })
    .expect(200);
});

test('auth endpoints are rate-limited after repeated failed attempts', async () => {
  await database.query('DELETE FROM auth_rate_limits');
  const csrf = await issueCsrf();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookie)
      .set('X-CSRF-Token', csrf.token)
      .send({ email: 'missing@campus.test', password })
      .expect(401);
  }
  await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('Cookie', csrf.cookie)
    .set('X-CSRF-Token', csrf.token)
    .send({ email: 'missing@campus.test', password })
    .expect(429);
});

test('college deactivation prevents access without invalidating a second college membership', async () => {
  const superAdmin = await signIn('root@campus.test');
  const sharedSession = await signIn('shared@campus.test');
  await request(app.getHttpServer())
    .patch(`/api/v1/colleges/${collegeA}/deactivate`)
    .set('Cookie', superAdmin.cookie)
    .set('X-CSRF-Token', superAdmin.csrfToken)
    .expect(200);

  await request(app.getHttpServer())
    .get('/api/v1/dashboard/summary')
    .set('Cookie', sharedSession.cookie)
    .set('X-College-Id', collegeA)
    .expect(403);
  await request(app.getHttpServer())
    .get('/api/v1/dashboard/summary')
    .set('Cookie', sharedSession.cookie)
    .set('X-College-Id', collegeB)
    .expect(200);
});