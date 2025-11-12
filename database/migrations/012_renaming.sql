-- 012_renaming.sql

-- 1) Drop FKs that reference or live on the soon-to-be-renamed tables
ALTER TABLE `emissions`
  DROP FOREIGN KEY `fk_em_factor`,
  DROP FOREIGN KEY `fk_em_prod`,
  DROP FOREIGN KEY `fk_em_stage`,
  DROP FOREIGN KEY `fk_em_tag`,
  DROP FOREIGN KEY `fk_em_user`,
  DROP FOREIGN KEY `fk_emissions_step`;

ALTER TABLE `stage_steps`
  DROP FOREIGN KEY `fk_stage_steps_stage`,
  DROP FOREIGN KEY `fk_stage_steps_tag`;

ALTER TABLE `stage_tags`
  DROP FOREIGN KEY `fk_tag_stage`;

-- 2) Rename tables (verify current names!)
RENAME TABLE 
  `emission_stages` TO `stages`,
  `stage_tags`       TO `tags`,
  `stage_steps`      TO `steps`;

-- 3) Re-add FKs with consistent names
-- Emissions
ALTER TABLE `emissions` 
  ADD CONSTRAINT `fk_factors_emissions_factor_id`
    FOREIGN KEY (`factor_id`)  REFERENCES `factors`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_products_emissions_product_id`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_stages_emissions_stage_id`
    FOREIGN KEY (`stage_id`)   REFERENCES `stages`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_tags_emissions_tag_id`
    FOREIGN KEY (`tag_id`)     REFERENCES `tags`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_users_emissions_user_id`
    FOREIGN KEY (`created_by`)    REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_steps_emissions_step_id`
    FOREIGN KEY (`step_id`)    REFERENCES `steps`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Steps
ALTER TABLE `steps`
  ADD CONSTRAINT `fk_stages_steps_stage_id`
    FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_tags_steps_tag_id`
    FOREIGN KEY (`tag_id`)   REFERENCES `tags`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Tags
ALTER TABLE `tags`
  ADD CONSTRAINT `fk_stages_tags_stage_id`
    FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
