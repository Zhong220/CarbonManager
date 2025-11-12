-- 013_stages_id.sql
-- For stages table
-- Change id column to string, etc. "id": "raw"
-- Change name to title, etc. "title": "原料取得"



-- 1. drop constraint if exists
ALTER TABLE tags DROP FOREIGN KEY `fk_stages_tags_stage_id`;
ALTER TABLE steps DROP FOREIGN KEY `fk_stages_steps_stage_id`;
ALTER TABLE emissions DROP FOREIGN KEY `fk_stages_emissions_stage_id`;

-- 2. modify id and name columns
ALTER TABLE stages
    MODIFY COLUMN id VARCHAR(50) NOT NULL,
    CHANGE COLUMN name title VARCHAR(255) NOT NULL;

ALTER TABLE emissions
    MODIFY COLUMN stage_id VARCHAR(50) NOT NULL;

ALTER TABLE steps
    MODIFY COLUMN stage_id VARCHAR(50) NOT NULL;

ALTER TABLE tags
    MODIFY COLUMN stage_id VARCHAR(50) NOT NULL;

-- 3. Update primary key
ALTER TABLE stages
    DROP PRIMARY KEY,
    ADD PRIMARY KEY (id);

-- 4. Add new constraints
ALTER TABLE emissions
    ADD CONSTRAINT `fk_stages_emissions_stage_id`
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE;
ALTER TABLE tags
    ADD CONSTRAINT `fk_stages_tags_stage_id`
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE;
ALTER TABLE steps
    ADD CONSTRAINT `fk_stages_steps_stage_id`
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE;

-- 5. Seed data 
INSERT INTO stages (id, title) VALUES
  ('raw', '原料取得'),
  ('manufacture', '製造'),
  ('distribution', '配送銷售'),
  ('use', '使用'),
  ('disposal', '廢棄處理');
