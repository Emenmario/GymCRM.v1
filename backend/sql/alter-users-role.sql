ALTER TABLE users
ALTER COLUMN role TYPE VARCHAR(20);

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('admin', 'staff', 'super_admin'));