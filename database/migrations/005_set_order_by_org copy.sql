-- 005_set_order_by_org.sql
-- Set order_id values for existing product_types and add UNIQUE constraint

-- Backfill 
UPDATE product_types p
JOIN (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY id) AS rn
  FROM product_types
) r ON r.id = p.id
SET p.order_id = r.rn
WHERE p.order_id IS NULL OR p.order_id = 0;

-- Conditionally add the UNIQUE index (no IF NOT EXISTS in ALTER TABLE for indexes)
SET @has_idx := (
  SELECT COUNT(*) 
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name   = 'product_types'
    AND index_name   = 'ux_pt_org_order'
);

SET @sql := IF(@has_idx = 0,
  'ALTER TABLE product_types ADD UNIQUE KEY ux_pt_org_order (organization_id, order_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Finally enforce NOT NULL
ALTER TABLE product_types
  MODIFY order_id INT UNSIGNED NOT NULL;
