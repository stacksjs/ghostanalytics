ALTER TABLE "sessions" ADD CONSTRAINT "sessions_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "sites"("id");
