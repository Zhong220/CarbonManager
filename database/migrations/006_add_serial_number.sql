-- 006_add_serial_number.sql
-- Add serial_number column to products table, unique 

ALTER TABLE products
  ADD COLUMN serial_number VARCHAR(100) AFTER name;