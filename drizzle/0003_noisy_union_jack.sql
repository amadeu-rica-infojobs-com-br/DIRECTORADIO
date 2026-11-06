ALTER TABLE "plays" ADD COLUMN "ip_hash" text;--> statement-breakpoint
CREATE INDEX "plays_ip_hash_created_at_idx" ON "plays" USING btree ("ip_hash","created_at");