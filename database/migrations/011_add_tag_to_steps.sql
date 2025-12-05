-- 011_add_tag_to_steps.sql
-- Add tag_id column to steps table

ALTER TABLE stage_steps
ADD COLUMN tag_id BIGINT UNSIGNED NOT NULL,
ADD CONSTRAINT fk_stage_steps_tag
    FOREIGN KEY (tag_id) REFERENCES stage_tags(id)
    ON DELETE CASCADE ON UPDATE CASCADE;
