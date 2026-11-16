CREATE TABLE "geo_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"status" text NOT NULL,
	"sha256" text NOT NULL,
	"filename" text NOT NULL,
	"storage_url" text,
	"file_size" integer DEFAULT 0 NOT NULL,
	"base_revision" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"summary" jsonb,
	"issues" jsonb,
	"author_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" integer
);
--> statement-breakpoint
CREATE TABLE "geo_citations" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_pk" integer NOT NULL,
	"cited_url" text NOT NULL,
	"host" text NOT NULL,
	"citation_order" integer
);
--> statement-breakpoint
CREATE TABLE "geo_question_states" (
	"project_id" integer NOT NULL,
	"market" text NOT NULL,
	"question_id" text NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer,
	CONSTRAINT "geo_question_states_project_id_market_question_id_pk" PRIMARY KEY("project_id","market","question_id")
);
--> statement-breakpoint
CREATE TABLE "geo_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"market" text NOT NULL,
	"question_id" text NOT NULL,
	"question_version" integer NOT NULL,
	"question" text NOT NULL,
	"category_id" text,
	"seo_keyword_id" text,
	"persona" text,
	"topic_group_id" text,
	"batch_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"run_id" text NOT NULL,
	"market" text NOT NULL,
	"question_id" text NOT NULL,
	"question_version" integer NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"platform" text NOT NULL,
	"model" text NOT NULL,
	"web_search" text NOT NULL,
	"status" text NOT NULL,
	"brand_mentioned" boolean,
	"answer_text" text,
	"error_code" text,
	"content_hash" text NOT NULL,
	"batch_id" integer,
	"replaces_run_id" text,
	"invalidated_at" timestamp with time zone,
	"invalidated_by" integer,
	"invalid_reason" text
);
--> statement-breakpoint
CREATE TABLE "import_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"kind" text NOT NULL,
	"action" text NOT NULL,
	"ref_id" integer,
	"actor_id" integer,
	"reason" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"code" text NOT NULL,
	"country" text NOT NULL,
	"language" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"brand_label" text DEFAULT 'DeDecker' NOT NULL,
	"client_domains" text[] DEFAULT '{}' NOT NULL,
	"active_seo_version_id" integer,
	"geo_revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "seo_categories" (
	"version_id" integer NOT NULL,
	"market" text NOT NULL,
	"category_id" text NOT NULL,
	"label" text NOT NULL,
	"include_in_dashboard" boolean NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "seo_categories_version_id_market_category_id_pk" PRIMARY KEY("version_id","market","category_id")
);
--> statement-breakpoint
CREATE TABLE "seo_competitor_scopes" (
	"version_id" integer NOT NULL,
	"market" text NOT NULL,
	"scope" text NOT NULL,
	"domain" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "seo_competitor_scopes_version_id_market_scope_domain_pk" PRIMARY KEY("version_id","market","scope","domain")
);
--> statement-breakpoint
CREATE TABLE "seo_competitors" (
	"version_id" integer NOT NULL,
	"market" text NOT NULL,
	"domain" text NOT NULL,
	"label" text NOT NULL,
	"color_hex" text,
	"sort_order" integer NOT NULL,
	CONSTRAINT "seo_competitors_version_id_market_domain_pk" PRIMARY KEY("version_id","market","domain")
);
--> statement-breakpoint
CREATE TABLE "seo_keywords" (
	"version_id" integer NOT NULL,
	"market" text NOT NULL,
	"keyword_id" text NOT NULL,
	"keyword" text NOT NULL,
	"category_id" text NOT NULL,
	"volume" integer NOT NULL,
	"has_ai_overview" boolean NOT NULL,
	"client_in_ai" boolean NOT NULL,
	"client_pos" integer,
	"client_url" text,
	"client_ai_sources" text[] DEFAULT '{}' NOT NULL,
	"subcategory" text,
	"priority" text,
	"source" text,
	"cpc" double precision,
	"competition" text,
	"paa" text,
	"legacy_ilwa_pos" integer,
	"sort_order" integer NOT NULL,
	CONSTRAINT "seo_keywords_version_id_market_keyword_id_pk" PRIMARY KEY("version_id","market","keyword_id")
);
--> statement-breakpoint
CREATE TABLE "seo_market_meta" (
	"version_id" integer NOT NULL,
	"market" text NOT NULL,
	"snapshot_date" date NOT NULL,
	"source" text NOT NULL,
	"notes" text,
	"device" text,
	"serp_depth" integer,
	"currency" text,
	CONSTRAINT "seo_market_meta_version_id_market_pk" PRIMARY KEY("version_id","market")
);
--> statement-breakpoint
CREATE TABLE "seo_rankings" (
	"version_id" integer NOT NULL,
	"market" text NOT NULL,
	"keyword_id" text NOT NULL,
	"domain" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "seo_rankings_version_id_market_keyword_id_domain_pk" PRIMARY KEY("version_id","market","keyword_id","domain")
);
--> statement-breakpoint
CREATE TABLE "seo_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"sha256" text NOT NULL,
	"filename" text NOT NULL,
	"storage_url" text,
	"file_size" integer DEFAULT 0 NOT NULL,
	"markets" text[] DEFAULT '{}' NOT NULL,
	"summary" jsonb,
	"issues" jsonb,
	"author_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "geo_batches" ADD CONSTRAINT "geo_batches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_citations" ADD CONSTRAINT "geo_citations_run_pk_geo_runs_id_fk" FOREIGN KEY ("run_pk") REFERENCES "public"."geo_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_question_states" ADD CONSTRAINT "geo_question_states_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_questions" ADD CONSTRAINT "geo_questions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_runs" ADD CONSTRAINT "geo_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_events" ADD CONSTRAINT "import_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_categories" ADD CONSTRAINT "seo_categories_version_id_seo_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."seo_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_competitor_scopes" ADD CONSTRAINT "seo_competitor_scopes_version_id_seo_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."seo_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_competitors" ADD CONSTRAINT "seo_competitors_version_id_seo_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."seo_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_keywords" ADD CONSTRAINT "seo_keywords_version_id_seo_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."seo_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_market_meta" ADD CONSTRAINT "seo_market_meta_version_id_seo_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."seo_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_rankings" ADD CONSTRAINT "seo_rankings_version_id_seo_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."seo_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_versions" ADD CONSTRAINT "seo_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "geo_batches_project_sha" ON "geo_batches" USING btree ("project_id","sha256");--> statement-breakpoint
CREATE INDEX "geo_citations_run" ON "geo_citations" USING btree ("run_pk");--> statement-breakpoint
CREATE UNIQUE INDEX "geo_questions_key" ON "geo_questions" USING btree ("project_id","market","question_id","question_version");--> statement-breakpoint
CREATE UNIQUE INDEX "geo_runs_key" ON "geo_runs" USING btree ("project_id","run_id");--> statement-breakpoint
CREATE INDEX "geo_runs_lookup" ON "geo_runs" USING btree ("project_id","market","observed_at");--> statement-breakpoint
CREATE INDEX "import_events_project" ON "import_events" USING btree ("project_id","kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "markets_project_code" ON "markets" USING btree ("project_id","code");--> statement-breakpoint
CREATE INDEX "seo_keywords_lookup" ON "seo_keywords" USING btree ("version_id","market","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_versions_project_sha" ON "seo_versions" USING btree ("project_id","sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_versions_project_version" ON "seo_versions" USING btree ("project_id","version");