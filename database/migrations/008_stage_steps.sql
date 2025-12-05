-- 008_stage_steps.sql

-- 1. Create the stage_steps table
DROP TABLE IF EXISTS stage_steps;

CREATE TABLE stage_steps (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    stage_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stage_steps_stage
        FOREIGN KEY (stage_id) REFERENCES emission_stages(id)
);

-- 2. Alter emissions table to add step_id column
ALTER TABLE emissions
    ADD COLUMN step_id BIGINT UNSIGNED NULL;

UPDATE emissions
SET step_id = NULL;

ALTER TABLE emissions
    ADD CONSTRAINT fk_emissions_step
        FOREIGN KEY (step_id) REFERENCES stage_steps(id)
        ON DELETE SET NULL;