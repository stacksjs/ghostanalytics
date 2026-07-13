ALTER TABLE "goals" ADD CONSTRAINT "goals_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "sites"("id");
