import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { openDatabase } from './database.js';
import { migrateDatabase } from './migrate.js';

const demoAdminEmail = process.env.DEMO_ADMIN_EMAIL ?? 'admin@college.test';
const demoPassword = process.env.DEMO_ADMIN_PASSWORD ?? 'Admin@12345';

if (process.env.NODE_ENV === 'production') {
  throw new Error('The development seed cannot run in production.');
}

const database = await openDatabase();

try {
  await migrateDatabase(database);
  const passwordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });

  const colleges = [
    { code: 'NORTH', name: 'Northfield College' },
    { code: 'LAKESIDE', name: 'Lakeside Institute' },
  ];

  for (const college of colleges) {
    await database.query(
      `INSERT INTO colleges (id, code, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (upper(code)) DO UPDATE
       SET name = EXCLUDED.name, status = 'active', deactivated_at = NULL, updated_at = now()`,
      [randomUUID(), college.code, college.name],
    );
  }

  const collegeRows = await database.query<{ id: string; code: string }>(
    `SELECT id, code FROM colleges WHERE code IN ('NORTH', 'LAKESIDE')`,
  );
  const collegeIds = new Map(collegeRows.rows.map((row) => [row.code, row.id]));

  const demoUsers = [
    { email: demoAdminEmail, fullName: 'Platform Administrator', roleCode: 'super_admin', collegeId: null },
    { email: 'admin.north@campus.demo', fullName: 'Northfield Administrator', roleCode: 'college_admin', collegeId: collegeIds.get('NORTH')! },
    { email: 'hod.north@campus.demo', fullName: 'Northfield HOD', roleCode: 'hod', collegeId: collegeIds.get('NORTH')! },
    { email: 'faculty.north@campus.demo', fullName: 'Northfield Faculty', roleCode: 'faculty', collegeId: collegeIds.get('NORTH')! },
    { email: 'student.north@campus.demo', fullName: 'Northfield Student', roleCode: 'student', collegeId: collegeIds.get('NORTH')! },
    { email: 'parent.north@campus.demo', fullName: 'Northfield Parent', roleCode: 'parent', collegeId: collegeIds.get('NORTH')! },
    { email: 'accountant.north@campus.demo', fullName: 'Northfield Accountant', roleCode: 'accountant', collegeId: collegeIds.get('NORTH')! },
    { email: 'librarian.north@campus.demo', fullName: 'Northfield Librarian', roleCode: 'librarian', collegeId: collegeIds.get('NORTH')! },
    { email: 'admin.lakeside@campus.demo', fullName: 'Lakeside Administrator', roleCode: 'college_admin', collegeId: collegeIds.get('LAKESIDE')! },
  ];

  for (const user of demoUsers) {
    const existing = await database.query<{ id: string }>(
      'SELECT id FROM users WHERE lower(email) = lower($1)',
      [user.email],
    );
    const userId = existing.rows[0]?.id ?? randomUUID();
    await database.query(
      `INSERT INTO users (id, email, full_name, password_hash, status, deactivated_at)
       VALUES ($1, lower($2), $3, $4, 'active', NULL)
       ON CONFLICT (lower(email)) DO UPDATE
       SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash,
           status = 'active', deactivated_at = NULL, updated_at = now()`,
      [userId, user.email, user.fullName, passwordHash],
    );
    await database.query(
      `INSERT INTO memberships (id, user_id, college_id, role_code, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (user_id, COALESCE(college_id, '')) DO UPDATE
       SET role_code = EXCLUDED.role_code, status = 'active', updated_at = now()`,
      [randomUUID(), userId, user.collegeId, user.roleCode],
    );
  }

  console.log(`Development accounts are ready. Super Admin: ${demoAdminEmail}`);
  console.log('The demo password is loaded from DEMO_ADMIN_PASSWORD or the development default.');
  console.log('College Admins: admin.north@campus.demo, admin.lakeside@campus.demo');
} finally {
  await database.close();
}