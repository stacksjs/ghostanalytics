CREATE TABLE IF NOT EXISTS `custom_events` (
  `id` varchar(64) PRIMARY KEY,
  `site_id` varchar(64),
  `session_id` varchar(64),
  `visitor_id` varchar(64),
  `name` varchar(128),
  `category` varchar(64),
  `value` integer,
  `properties` varchar(255),
  `path` varchar(255),
  `timestamp` varchar(32),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  SHARD KEY (`id`),
  SORT KEY (`site_id`, `timestamp`)
);
