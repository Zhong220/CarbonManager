-- 007_factors.sql
-- Modify the 'factors' table

-- New schema of 'factors' table:
-- +-------------------+-----------------+------+-----+-------------------+-------------------+
-- | Field             | Type            | Null | Key | Default           | Extra             |
-- +-------------------+-----------------+------+-----+-------------------+-------------------+
-- | id                | int             | NO   | PRI | NULL              | auto_increment    |
-- | name              | varchar(255)    | NO   |     | NULL              |                   |
-- | coefficient        | double          | NO   |     | NULL              |                   |
-- | unit              | varchar(50)     | NO   |     | NULL              |                   |
-- | announce_year     | int             | NO   |     | NULL              |                   |
-- | category          | varchar(255)    | NO   |     | NULL              |                   |
-- | subcategory       | varchar(255)    | NO   |     | NULL              |                   |
-- | midcategory       | varchar(255)    | NO   |     | NULL              |                   |
-- | source            | varchar(255)    | NO   |     | NULL              |                   |
-- +-------------------+-----------------+------+-----+-------------------+-------------------+

-- 1. Remove constraint 
ALTER TABLE emissions
    DROP FOREIGN KEY fk_em_factor;

-- 2. Drop and recreate the 'factors' table with the new schema
DROP TABLE IF EXISTS factors;

CREATE TABLE factors (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    coefficient DOUBLE NOT NULL,
    unit VARCHAR(50) NOT NULL,
    announcement_year INT NOT NULL,
    category VARCHAR(255) NOT NULL,
    subcategory VARCHAR(255) NOT NULL,
    midcategory VARCHAR(255) NOT NULL,
    source VARCHAR(255) NOT NULL
);

-- 3. Re-add foreign key constraint
ALTER TABLE emissions
    ADD CONSTRAINT fk_em_factor
    FOREIGN KEY (factor_id) REFERENCES factors(id)
    ON DELETE CASCADE ON UPDATE CASCADE;
