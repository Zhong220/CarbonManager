-- SET FOREIGN_KEY_CHECKS = 1;
-- 002_add_emission_name.sql
-- Add user-defined name to emissions; relax optional columns on factors.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1) Conditionally add column `name`
SET @col_exist := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'emissions'
    AND COLUMN_NAME = 'name'
);

SET @sql := IF(@col_exist = 0,
  'ALTER TABLE emissions ADD COLUMN name VARCHAR(200) NULL AFTER id;',
  'SELECT "Column `name` already exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Factors: allow NULL for descriptive fields
ALTER TABLE factors
  MODIFY COLUMN unit           VARCHAR(50)   NULL,
  MODIFY COLUMN value_per_unit DOUBLE        NULL,
  MODIFY COLUMN category       VARCHAR(100)  NULL,
  MODIFY COLUMN region         VARCHAR(100)  NULL,
  MODIFY COLUMN source         VARCHAR(255)  NULL;

SET FOREIGN_KEY_CHECKS = 1;
