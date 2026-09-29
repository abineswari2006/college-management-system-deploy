INSERT INTO permissions (code, name, scope)
VALUES ('users.manage', 'Manage system users', 'system')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code)
VALUES ('super_admin', 'users.manage')
ON CONFLICT (role_code, permission_code) DO NOTHING;

INSERT INTO system_settings (key, value) VALUES
  ('platform_name', '"College Management"'::jsonb),
  ('support_email', '""'::jsonb),
  ('maintenance_mode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;