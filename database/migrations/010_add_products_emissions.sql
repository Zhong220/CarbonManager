-- 010_add_products_emissions.sql
-- Add target column to products and unit target amount to emissions table

ALTER TABLE products
ADD COLUMN target VARCHAR(255);

ALTER TABLE emissions
ADD COLUMN unit_target_amount FLOAT;
