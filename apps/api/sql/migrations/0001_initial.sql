CREATE TABLE colleges (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated')),
  timezone text NOT NULL DEFAULT 'UTC',
  locale text NOT NULL DEFAULT 'en',
  currency char(3) NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  CONSTRAINT colleges_code_format CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$')
);

CREATE UNIQUE INDEX colleges_code_unique ON colleges (upper(code));
CREATE INDEX colleges_status_created_idx ON colleges (status, created_at DESC);

CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL,
  password_hash text,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'deactivated')),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE INDEX users_status_created_idx ON users (status, created_at DESC);

CREATE TABLE roles (
  code text PRIMARY KEY,
  name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('system', 'college')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_role_scope CHECK ((code = 'super_admin' AND scope = 'system') OR (code <> 'super_admin' AND scope = 'college'))
);

CREATE TABLE memberships (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  college_id text REFERENCES colleges(id) ON DELETE RESTRICT,
  role_code text NOT NULL REFERENCES roles(code) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membership_role_scope CHECK ((role_code = 'super_admin' AND college_id IS NULL) OR (role_code <> 'super_admin' AND college_id IS NOT NULL))
);

CREATE UNIQUE INDEX memberships_user_college_unique ON memberships (user_id, COALESCE(college_id, ''));
CREATE INDEX memberships_college_role_status_idx ON memberships (college_id, role_code, status);
CREATE INDEX memberships_user_status_idx ON memberships (user_id, status);

CREATE TABLE permissions (
  code text PRIMARY KEY,
  name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('system', 'college')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_code text NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);

CREATE INDEX auth_sessions_user_expiry_idx ON auth_sessions (user_id, expires_at DESC);

CREATE TABLE password_reset_tokens (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX password_reset_user_expiry_idx ON password_reset_tokens (user_id, expires_at DESC);

CREATE TABLE audit_logs (
  id text PRIMARY KEY,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  college_id text REFERENCES colleges(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_college_created_idx ON audit_logs (college_id, created_at DESC);
CREATE INDEX audit_logs_actor_created_idx ON audit_logs (actor_user_id, created_at DESC);

CREATE TABLE system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO roles (code, name, scope) VALUES
  ('super_admin', 'Super Admin', 'system'),
  ('college_admin', 'College Admin', 'college'),
  ('principal', 'Principal', 'college'),
  ('hod', 'HOD', 'college'),
  ('faculty', 'Faculty', 'college'),
  ('student', 'Student', 'college'),
  ('parent', 'Parent', 'college'),
  ('accountant', 'Accountant', 'college'),
  ('librarian', 'Librarian', 'college'),
  ('hr_staff', 'HR/Staff', 'college');

INSERT INTO permissions (code, name, scope) VALUES
  ('colleges.view', 'View colleges', 'system'),
  ('colleges.create', 'Create colleges', 'system'),
  ('colleges.update', 'Update colleges', 'system'),
  ('colleges.deactivate', 'Deactivate colleges', 'system'),
  ('users.view', 'View users', 'college'),
  ('users.create', 'Create users', 'college'),
  ('users.update', 'Update users', 'college'),
  ('users.deactivate', 'Deactivate users', 'college'),
  ('settings.manage', 'Manage settings', 'system'),
  ('dashboard.view', 'View dashboard', 'college'),
  ('audit.view', 'View audit logs', 'system'),
  ('students.view', 'View students', 'college'),
  ('students.create', 'Create students', 'college'),
  ('students.update', 'Update students', 'college'),
  ('students.delete', 'Delete students', 'college'),
  ('faculty.view', 'View faculty', 'college'),
  ('faculty.create', 'Create faculty', 'college'),
  ('faculty.update', 'Update faculty', 'college'),
  ('faculty.delete', 'Delete faculty', 'college'),
  ('attendance.view', 'View attendance', 'college'),
  ('attendance.create', 'Create attendance', 'college'),
  ('attendance.update', 'Update attendance', 'college'),
  ('marks.view', 'View marks', 'college'),
  ('marks.create', 'Create marks', 'college'),
  ('fees.view', 'View fees', 'college'),
  ('fees.create', 'Create fees and payments', 'college'),
  ('reports.view', 'View reports', 'college'),
  ('assignments.manage', 'Manage assignments', 'college'),
  ('library.manage', 'Manage library', 'college'),
  ('leave.manage', 'Manage leave', 'college'),
  ('documents.manage', 'Manage documents', 'college');

INSERT INTO role_permissions (role_code, permission_code)
SELECT 'super_admin', code FROM permissions;

INSERT INTO role_permissions (role_code, permission_code) VALUES
  ('college_admin', 'users.view'),
  ('college_admin', 'users.create'),
  ('college_admin', 'users.update'),
  ('college_admin', 'users.deactivate'),
  ('college_admin', 'dashboard.view'),
  ('college_admin', 'students.view'),
  ('college_admin', 'students.create'),
  ('college_admin', 'students.update'),
  ('college_admin', 'students.delete'),
  ('college_admin', 'faculty.view'),
  ('college_admin', 'faculty.create'),
  ('college_admin', 'faculty.update'),
  ('college_admin', 'faculty.delete'),
  ('college_admin', 'attendance.view'),
  ('college_admin', 'attendance.create'),
  ('college_admin', 'attendance.update'),
  ('college_admin', 'marks.view'),
  ('college_admin', 'marks.create'),
  ('college_admin', 'fees.view'),
  ('college_admin', 'fees.create'),
  ('college_admin', 'reports.view'),
  ('college_admin', 'assignments.manage'),
  ('college_admin', 'library.manage'),
  ('college_admin', 'leave.manage'),
  ('college_admin', 'documents.manage'),
  ('principal', 'dashboard.view'),
  ('principal', 'students.view'),
  ('principal', 'faculty.view'),
  ('principal', 'attendance.view'),
  ('principal', 'marks.view'),
  ('principal', 'fees.view'),
  ('principal', 'reports.view'),
  ('hod', 'dashboard.view'),
  ('hod', 'students.view'),
  ('hod', 'faculty.view'),
  ('hod', 'attendance.view'),
  ('hod', 'marks.view'),
  ('hod', 'assignments.manage'),
  ('faculty', 'dashboard.view'),
  ('faculty', 'students.view'),
  ('faculty', 'attendance.view'),
  ('faculty', 'attendance.create'),
  ('faculty', 'attendance.update'),
  ('faculty', 'marks.view'),
  ('faculty', 'marks.create'),
  ('faculty', 'assignments.manage'),
  ('student', 'dashboard.view'),
  ('student', 'attendance.view'),
  ('student', 'marks.view'),
  ('student', 'fees.view'),
  ('parent', 'dashboard.view'),
  ('parent', 'attendance.view'),
  ('parent', 'marks.view'),
  ('parent', 'fees.view'),
  ('accountant', 'dashboard.view'),
  ('accountant', 'fees.view'),
  ('accountant', 'fees.create'),
  ('accountant', 'reports.view'),
  ('librarian', 'dashboard.view'),
  ('librarian', 'library.manage'),
  ('hr_staff', 'dashboard.view'),
  ('hr_staff', 'leave.manage');