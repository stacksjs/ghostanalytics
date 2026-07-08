CREATE TABLE IF NOT EXISTS `goals` (
  `id` varchar(255) PRIMARY KEY,
  `site_id` varchar(255),
  `name` varchar(255),
  `type` varchar(255),
  `pattern` varchar(255),
  `match_type` varchar(255),
  `duration_minutes` integer,
  `value` integer,
  `is_active` tinyint(1),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
