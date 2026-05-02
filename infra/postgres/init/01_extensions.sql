-- ═══════════════════════════════════════════════════════════════════════════
-- Script d'initialisation PostgreSQL — Supply Chain Industrielle
-- Exécuté automatiquement au premier démarrage du conteneur
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- Génération UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_uuid() + chiffrement
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- Recherche full-text trigram

-- Paramètres de performance pour la supply chain
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '512MB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Timezone UTC obligatoire (tous les timestamps en UTC)
SET timezone = 'UTC';

SELECT 'Extensions PostgreSQL installées avec succès' AS status;
