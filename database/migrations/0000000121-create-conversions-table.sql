CREATE TABLE IF NOT EXISTS `conversions` (
  `id` varchar(255) PRIMARY KEY,
  `site_id` varchar(255),
  `goal_id` varchar(255),
  `visitor_id` varchar(255),
  `session_id` varchar(255),
  `value` integer,
  `path` varchar(255),
  `referrer_source` varchar(255),
  `utm_source` varchar(255),
  `utm_campaign` varchar(255),
  `timestamp` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  SHARD KEY (`id`),
  SORT KEY ()
);
