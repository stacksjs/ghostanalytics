ALTER TABLE `page_views` ADD CONSTRAINT `page_views_site_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`);
ALTER TABLE `page_views` ADD CONSTRAINT `page_views_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`);
