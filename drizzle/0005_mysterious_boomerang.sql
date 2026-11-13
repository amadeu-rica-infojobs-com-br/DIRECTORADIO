ALTER TABLE "stations" ADD COLUMN "language_codes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "stations_language_codes_idx" ON "stations" USING gin ("language_codes");