-- 004_add_oder_id.sql
-- Add order_id to product_types table for frontend ordering


SET NAMES utf8mb4;

ALTER TABLE product_types
    ADD COLUMN order_id INT UNSIGNED NOT NULL AFTER id;

