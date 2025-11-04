-- database/seeds/dev_seed_min.sql
-- Minimal seed: 1 org, 1 user, 1 type, 1 product, 2 stages, 2 factors, 1 emission

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- org
INSERT INTO organizations (name, slug)
VALUES ('Demo Org', 'demo-org')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @org := LAST_INSERT_ID();

-- user (shop)
INSERT INTO users (email_account, password_hash, name, user_type, organization_id)
VALUES ('owner@demo.org', 'dev-hash', 'Owner', 'shop', @org)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @u_shop := LAST_INSERT_ID();

-- product type
INSERT INTO product_types (order_id, organization_id, name)
VALUES (1, @org, 'DemoType')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @ptype := LAST_INSERT_ID();

-- product
INSERT INTO products (organization_id, type_id, name, code)
VALUES (@org, @ptype, 'Demo Product', 'DEMO-001')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @prod := LAST_INSERT_ID();

-- stages (ensure two basic ones exist)
INSERT INTO emission_stages (name) VALUES ('Production')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @st_prod := (SELECT id FROM emission_stages WHERE name='Production' LIMIT 1);

INSERT INTO emission_stages (name) VALUES ('Transport')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @st_trans := (SELECT id FROM emission_stages WHERE name='Transport' LIMIT 1);

-- factors (simple reference rows)
INSERT INTO factors (name, unit, value_per_unit, category, region, source, usage_count)
VALUES ('Electricity (demo)', 'kWh', 0.5, 'Energy', 'TW', 'seed', 0)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @f_elec := LAST_INSERT_ID();

INSERT INTO factors (name, unit, value_per_unit, category, region, source, usage_count)
VALUES ('Diesel (demo)', 'L', 2.6, 'Fuel', 'GLOBAL', 'seed', 0)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @f_diesel := LAST_INSERT_ID();

-- ONE emission (the one you’ll send on-chain)
-- Note: tag_id NULL is fine; sort_order = 1
INSERT IGNORE INTO emissions
  (name, product_id, stage_id, factor_id, tag_id, created_by, sort_order, quantity, emission_amount)
VALUES
  ('Seed Emission', @prod, @st_prod, @f_elec, NULL, @u_shop, 1, 42, NULL);

SET FOREIGN_KEY_CHECKS = 1;
