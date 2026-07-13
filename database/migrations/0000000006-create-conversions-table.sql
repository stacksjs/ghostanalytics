CREATE TABLE IF NOT EXISTS "conversions" (
  "id" varchar(64) PRIMARY KEY,
  "site_id" varchar(64),
  "goal_id" varchar(64),
  "visitor_id" varchar(64),
  "session_id" varchar(64),
  "value" integer,
  "path" varchar(255),
  "referrer_source" varchar(128),
  "utm_source" varchar(128),
  "utm_campaign" varchar(128),
  "timestamp" varchar(32),
  "created_at" timestamp not null default CURRENT_TIMESTAMP,
  "updated_at" timestamp
);
