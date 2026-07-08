CREATE TABLE IF NOT EXISTS `sites` (
  `id` varchar(255) PRIMARY KEY,
  `name` varchar(255),
  `domains` varchar(255),
  `timezone` varchar(255),
  `is_active` tinyint(1),
  `owner_id` integer,
  `settings` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  SHARD KEY (`id`),
  SORT KEY ()
);
