ALTER TABLE `conversions` ADD CONSTRAINT `conversions_site_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`);
ALTER TABLE `conversions` ADD CONSTRAINT `conversions_goal_id_fk` FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`);
ALTER TABLE `conversions` ADD CONSTRAINT `conversions_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`);
