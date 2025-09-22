-- 003_emissions_onchain.sql
-- Track on-chain handoff for each emission

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS emissions_onchain (
  id             BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  emission_id    BIGINT UNSIGNED NOT NULL,
  status         ENUM('pending','submitted','confirmed','failed') NOT NULL DEFAULT 'pending',
  tx_hash        VARCHAR(66) NULL,              -- set by chain-service on submit/confirm
  payload_json   JSON NOT NULL,                 -- data sent to chain-service
  error_msg      VARCHAR(500) NULL,             -- last error if failed
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_eo_emission FOREIGN KEY (emission_id)
    REFERENCES emissions(id) ON DELETE CASCADE,

  UNIQUE KEY ux_emission_once (emission_id),    -- one record per emission (simple model)
  UNIQUE KEY ux_tx_hash (tx_hash),
  KEY idx_status (status),
  KEY idx_updated (updated_at)
);

SET FOREIGN_KEY_CHECKS = 1;
