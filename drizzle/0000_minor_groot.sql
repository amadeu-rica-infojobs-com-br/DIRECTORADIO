CREATE TYPE "public"."genre" AS ENUM('pop', 'electronica', 'rock', 'jazz', 'clasica', 'variada', 'noticias', 'deportes', 'generalista');--> statement-breakpoint
CREATE TYPE "public"."station_status" AS ENUM('activa', 'desactivada', 'eliminada');--> statement-breakpoint
CREATE TABLE "station_tags" (
	"station_id" uuid NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "station_tags_station_id_tag_id_pk" PRIMARY KEY("station_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"description_generated" boolean DEFAULT false,
	"logo_url" text,
	"stream_url" text NOT NULL,
	"homepage_url" text,
	"country_code" varchar(2),
	"languages" text[] DEFAULT '{}'::text[],
	"genre" "genre" DEFAULT 'variada' NOT NULL,
	"status" "station_status" DEFAULT 'activa' NOT NULL,
	"source" text NOT NULL,
	"external_id" text,
	"rb_click_count" integer DEFAULT 0,
	"play_count" integer DEFAULT 0,
	"rating_avg" numeric(3, 2) DEFAULT '0',
	"rating_count" integer DEFAULT 0,
	"health_last_checked_at" timestamp with time zone,
	"health_last_ok" boolean,
	"health_consecutive_failures" integer DEFAULT 0,
	"manual_fields" text[] DEFAULT '{}'::text[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "stations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tag_genres" (
	"tag" text PRIMARY KEY NOT NULL,
	"genre" "genre" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "station_tags" ADD CONSTRAINT "station_tags_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_tags" ADD CONSTRAINT "station_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stations_source_external_id_idx" ON "stations" USING btree ("source","external_id");