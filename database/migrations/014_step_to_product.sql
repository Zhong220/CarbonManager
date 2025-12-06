-- 014_step_to_product.sql
-- Add foreign key constraint to link steps to products via stages

ALTER TABLE steps
    ADD COLUMN product_id BIGINT UNSIGNED;

ALTER TABLE steps 
    ADD CONSTRAINT `fk_products_steps_id`
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
