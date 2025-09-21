-- 002_add_emission_name.sql
-- Add user-defined name to emissions; relax optional columns on factors.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1) Emissions: add name (nullable), backfill, then enforce NOT NULL
ALTER TABLE emissions
  ADD COLUMN name VARCHAR(200) NULL AFTER id;

-- NOTE: Intentionally keep tag_id and created_by as NULL-able for now.

-- 2) Factors: allow NULL for descriptive fields; keep safe defaults for timestamps/counters
ALTER TABLE factors
  MODIFY COLUMN unit           VARCHAR(50)   NULL,
  MODIFY COLUMN value_per_unit DOUBLE        NULL,
  MODIFY COLUMN category       VARCHAR(100)  NULL,
  MODIFY COLUMN region         VARCHAR(100)  NULL,
  MODIFY COLUMN source         VARCHAR(255)  NULL,


SET FOREIGN_KEY_CHECKS = 1;
