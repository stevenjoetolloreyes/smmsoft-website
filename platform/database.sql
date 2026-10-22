-- ============================================================
--  SMMSOFT — SMS Provider Platform — database schema
--  Import in phpMyAdmin (creates the database + tables).
--  Admin login: admin@smmsoft.local / admin123 (CHANGE IT!)
-- ============================================================

CREATE DATABASE IF NOT EXISTS smmsoft CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smmsoft;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  api_key VARCHAR(64) NOT NULL UNIQUE,
  credits INT NOT NULL DEFAULT 0,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Admin: admin@smmsoft.local / admin123 (bcrypt)
INSERT INTO users (name, email, password_hash, api_key, credits, is_admin) VALUES
('SMMSOFT Admin', 'admin@smmsoft.local', '$2y$10$GP2ZB2/Qvf1JpO0LZSOaCuq7nafYhWjzghlsREyUE/sJ6rB0ICqWS', 'ADMINKEY-CHANGE-ME', 0, 1)
ON DUPLICATE KEY UPDATE email = email;

CREATE TABLE IF NOT EXISTS credit_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  type ENUM('purchase','send','refund','adjust') NOT NULL,
  amount INT NOT NULL,
  balance_after INT NOT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS topups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  credits_wanted INT NOT NULL,
  amount_peso DECIMAL(10,2) NOT NULL,
  pay_ref VARCHAR(120) NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decided_at DATETIME NULL,
  INDEX idx_user (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sms_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  semaphore_id BIGINT NULL,
  recipient VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  sender_name VARCHAR(32) NULL,
  network VARCHAR(32) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'Queued',
  msg_type VARCHAR(16) NOT NULL DEFAULT 'Single',
  kind VARCHAR(16) NOT NULL DEFAULT 'regular',
  credits_charged INT NOT NULL DEFAULT 0,
  source VARCHAR(16) NOT NULL DEFAULT 'web',
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_semaphore (semaphore_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sms_contacts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  number VARCHAR(32) NOT NULL,
  group_name VARCHAR(80) NOT NULL DEFAULT 'General',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_group (group_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sms_settings (
  k VARCHAR(80) PRIMARY KEY,
  v TEXT NULL
) ENGINE=InnoDB;

INSERT INTO sms_settings (k, v) VALUES
('upstream_api_key', ''),
('default_sender', 'SMMSOFT'),
('price_per_credit', '0.65'),
('cost_regular', '1'),
('cost_priority', '2'),
('cost_otp', '2'),
('welcome_credits', '0'),
('payment_instructions', 'Pay via GCash: 09XX XXX XXXX (SMMSOFT). After paying, submit the reference number below. Credits are added once the admin verifies your payment.'),
('balance_cache', ''),
('balance_cached_at', '0')
ON DUPLICATE KEY UPDATE k = k;
