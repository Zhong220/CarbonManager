-- 001_init.sql: Database initialization script for CarbonManager
 
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS emissions;
DROP TABLE IF EXISTS factors;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS product_types;
DROP TABLE IF EXISTS stage_tags;
DROP TABLE IF EXISTS emission_stages;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS organizations;

-- Organizations
CREATE TABLE organizations (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(200) NOT NULL,
  slug       VARCHAR(120) NULL,                       -- optional, for clean URLs
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_org_name (name),
  UNIQUE KEY ux_org_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Users (shop & customer)
CREATE TABLE users (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email_account VARCHAR(255) NOT NULL,
  email_ci     VARCHAR(255) AS (LOWER(email_account)) STORED,
  password_hash VARCHAR(255) NOT NULL,
  name         VARCHAR(255) NULL,
  user_type    ENUM('shop','customer') NOT NULL DEFAULT 'customer',
  organization_id BIGINT UNSIGNED NULL,               -- set when user_type='shop'
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_users_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,

  UNIQUE KEY ux_users_email_ci (email_ci)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Product types (per org)
CREATE TABLE product_types (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_pt_org FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE CASCADE,

  UNIQUE KEY ux_pt_org_name (organization_id, name),
  KEY idx_pt_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Emission stages (system fixed list)
CREATE TABLE emission_stages (
  id   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  UNIQUE KEY ux_stage_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stage tags (system-defined per stage)
CREATE TABLE stage_tags (
  id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  stage_id  BIGINT UNSIGNED NOT NULL,
  name      VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,

  CONSTRAINT fk_tag_stage FOREIGN KEY (stage_id)
    REFERENCES emission_stages(id) ON DELETE RESTRICT,

  UNIQUE KEY ux_stage_tag_name (stage_id, name),
  KEY idx_tag_stage (stage_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Products (per org; optional SKU/slug code)
CREATE TABLE products (
  id               BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id  BIGINT UNSIGNED NOT NULL,
  type_id          BIGINT UNSIGNED NULL,
  name             VARCHAR(200) NOT NULL,
  total_emission   DOUBLE DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at         TIMESTAMP NULL,
  code             VARCHAR(50) NULL,                  -- SKU/slug

  CONSTRAINT fk_prod_org  FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_prod_type FOREIGN KEY (type_id)
    REFERENCES product_types(id) ON DELETE SET NULL,

  -- choose per-org uniqueness for code (typical)
  UNIQUE KEY ux_prod_org_code (organization_id, code),
  KEY idx_prod_org (organization_id),
  KEY idx_prod_type (type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Factors (reference)
CREATE TABLE factors (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(200) NOT NULL,
  unit            VARCHAR(50),
  value_per_unit  DOUBLE,
  category        VARCHAR(100),
  region          VARCHAR(100),
  source          VARCHAR(255),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usage_count     INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Reports (per org)
CREATE TABLE reports (
  id               BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id  BIGINT UNSIGNED NOT NULL,
  name             VARCHAR(200) NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_reports_org FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Emissions (ordered within product+stage)
CREATE TABLE emissions (
  id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  product_id          BIGINT UNSIGNED NOT NULL,
  stage_id            BIGINT UNSIGNED NOT NULL,
  factor_id           BIGINT UNSIGNED NOT NULL,
  tag_id              BIGINT UNSIGNED NULL,
  created_by          BIGINT UNSIGNED NULL,

  sort_order          INT NOT NULL,                    -- order within (product,stage)

  quantity            DOUBLE NULL,
  transport_origin    VARCHAR(255) NULL,
  transport_method    VARCHAR(100) NULL,
  distance_per_trip   DOUBLE NULL,
  transport_unit      VARCHAR(50) NULL,
  usage_ratio         DOUBLE NULL,
  allocation_basis    VARCHAR(255) NULL,
  fuel_input_per_unit DOUBLE NULL,
  fuel_input_unit     VARCHAR(50) NULL,
  land_transport_tkm  DOUBLE NULL,
  emission_amount     DOUBLE NULL,

  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_em_prod   FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_em_stage  FOREIGN KEY (stage_id)   REFERENCES emission_stages(id) ON DELETE RESTRICT,
  CONSTRAINT fk_em_factor FOREIGN KEY (factor_id)  REFERENCES factors(id) ON DELETE RESTRICT,
  CONSTRAINT fk_em_tag    FOREIGN KEY (tag_id)     REFERENCES stage_tags(id) ON DELETE SET NULL,
  CONSTRAINT fk_em_user   FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE KEY ux_em_order (product_id, stage_id, sort_order),
  KEY idx_em_prod_stage (product_id, stage_id),
  KEY idx_em_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
