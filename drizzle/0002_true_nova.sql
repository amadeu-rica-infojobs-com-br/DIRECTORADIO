CREATE TABLE "plays" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"station_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plays_station_session_idx" ON "plays" USING btree ("station_id","session_id");--> statement-breakpoint
CREATE INDEX "plays_created_at_idx" ON "plays" USING btree ("created_at");