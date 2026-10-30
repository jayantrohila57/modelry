CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "asset_chunk" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"user_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_folder" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD COLUMN "pathname" text;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD COLUMN "file_type" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD COLUMN "category" text DEFAULT 'Uncategorized' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD COLUMN "folder_id" text;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD COLUMN "extracted_text" text;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD COLUMN "extracted_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD COLUMN "processing_status" text DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD COLUMN "processing_progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD COLUMN "processing_error" text;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD COLUMN "indexed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "asset_chunk" ADD CONSTRAINT "asset_chunk_asset_id_chat_attachment_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."chat_attachment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_chunk" ADD CONSTRAINT "asset_chunk_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_folder" ADD CONSTRAINT "asset_folder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_chunk_asset_index_unique_idx" ON "asset_chunk" USING btree ("asset_id","chunk_index");--> statement-breakpoint
CREATE INDEX "asset_chunk_embedding_hnsw_idx" ON "asset_chunk" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "asset_chunk_user_idx" ON "asset_chunk" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_folder_user_name_unique_idx" ON "asset_folder" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "asset_folder_user_created_idx" ON "asset_folder" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD CONSTRAINT "chat_attachment_folder_id_asset_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."asset_folder"("id") ON DELETE set null ON UPDATE no action;
