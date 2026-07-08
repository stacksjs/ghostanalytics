ALTER TABLE `custom_events` ADD CONSTRAINT `custom_events_site_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`);
ALTER TABLE `custom_events` ADD CONSTRAINT `custom_events_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`);
