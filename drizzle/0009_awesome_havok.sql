CREATE TYPE "public"."rating_status" AS ENUM('pending', 'verified');--> statement-breakpoint
CREATE TABLE "rating_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ip_hash" text,
	"email" text NOT NULL,
	"sent_email" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"station_id" uuid NOT NULL,
	"email" text NOT NULL,
	"stars" integer NOT NULL,
	"status" "rating_status" NOT NULL,
	"token_hash" text,
	"token_expires_at" timestamp with time zone,
	"privacy_accepted_at" timestamp with time zone NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_stars_check" CHECK ("ratings"."stars" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "verified_emails" (
	"email" text PRIMARY KEY NOT NULL,
	"first_verified_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"privacy_accepted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rating_attempts_ip_created_idx" ON "rating_attempts" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "rating_attempts_email_created_idx" ON "rating_attempts" USING btree ("email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_station_email_status_idx" ON "ratings" USING btree ("station_id","email","status");--> statement-breakpoint
CREATE INDEX "ratings_token_hash_idx" ON "ratings" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "ratings_email_idx" ON "ratings" USING btree ("email");