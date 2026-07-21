-- Privacy: country-only geolocation is an invariant (issue #7). The sub-country
-- region/city columns were dormant (never populated by /collect), so drop them
-- to remove the latent capability from the schema entirely. Idempotent.
ALTER TABLE "page_views" DROP COLUMN IF EXISTS "region";
ALTER TABLE "page_views" DROP COLUMN IF EXISTS "city";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "region";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "city";
