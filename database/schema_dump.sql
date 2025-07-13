-- Export current database schema
-- Run this in MySQL to get the current schema

-- Export database structure
SHOW CREATE DATABASE carbon_footprint;

-- Export table structures
SHOW CREATE TABLE users;
SHOW CREATE TABLE factors;
SHOW CREATE TABLE products;
SHOW CREATE TABLE emission_stages;
SHOW CREATE TABLE emissions;
SHOW CREATE TABLE reports;

-- Show all indexes
SHOW INDEX FROM users;
SHOW INDEX FROM factors;
SHOW INDEX FROM products;
SHOW INDEX FROM emission_stages;
SHOW INDEX FROM emissions;
SHOW INDEX FROM reports;

-- Show table information
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    DATA_LENGTH,
    INDEX_LENGTH,
    (DATA_LENGTH + INDEX_LENGTH) as TOTAL_SIZE
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'carbon_footprint'; 