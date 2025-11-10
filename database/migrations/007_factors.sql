-- 007_factors.sql
-- Modify the 'factors' table

-- Current schema of 'factors' table:
-- +----------------+-----------------+------+-----+-------------------+-------------------+
-- | Field          | Type            | Null | Key | Default           | Extra             |
-- +----------------+-----------------+------+-----+-------------------+-------------------+
-- | id             | bigint unsigned | NO   | PRI | NULL              | auto_increment    |
-- | name           | varchar(200)    | NO   |     | NULL              |                   |
-- | unit           | varchar(50)     | YES  |     | NULL              |                   |
-- | value_per_unit | double          | YES  |     | NULL              |                   |
-- | category       | varchar(100)    | YES  |     | NULL              |                   |
-- | region         | varchar(100)    | YES  |     | NULL              |                   |
-- | source         | varchar(255)    | YES  |     | NULL              |                   |
-- | created_at     | timestamp       | NO   |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
-- | usage_count    | int             | NO   |     | 0                 |                   |
-- +----------------+-----------------+------+-----+-------------------+-------------------+

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

