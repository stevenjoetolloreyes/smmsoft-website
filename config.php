<?php
// ============================================================
//  SMMSOFT — SMS Provider Platform — CONFIG
//  Fill in your own values. NEVER share this file.
// ============================================================

// --- Database (MySQL) ---
define('DB_HOST', 'localhost');
define('DB_NAME', 'smmsoft');
define('DB_USER', 'root');
define('DB_PASS', '');

// --- Upstream provider (Semaphore) ---
// SMMSOFT sends through YOUR Semaphore account. Your customers never see it.
// Paste your API key here OR set it in Admin > Settings after install.
define('UPSTREAM_API_KEY', '');

// Fallback sender name (must be APPROVED on the upstream account,
// max 11 characters — e.g. SMMSOFT). Admin > Settings overrides this.
define('UPSTREAM_SENDER', 'SMMSOFT');

// Upstream API base (do not change unless testing)
define('SEMAPHORE_BASE', 'https://api.semaphore.co/api/v4');
