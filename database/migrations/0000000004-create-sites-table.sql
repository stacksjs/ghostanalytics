CREATE TABLE IF NOT EXISTS "sites" (
  "id" varchar(255) PRIMARY KEY,
  "name" varchar(255),
  "domains" varchar(255),
  "timezone" varchar(255),
  "is_active" boolean,
  "owner_id" integer,
  "settings" varchar(255),
  "created_at" timestamp not null default CURRENT_TIMESTAMP,
  "updated_at" timestamp
);
