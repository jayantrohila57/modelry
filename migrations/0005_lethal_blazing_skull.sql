CREATE TABLE "chat_message_asset" (
	"message_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"user_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_asset_message_id_asset_id_pk" PRIMARY KEY("message_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD COLUMN "processing_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_message_asset" ADD CONSTRAINT "chat_message_asset_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_asset" ADD CONSTRAINT "chat_message_asset_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_asset" ADD CONSTRAINT "chat_message_asset_owner_fk" FOREIGN KEY ("asset_id","user_id") REFERENCES "public"."chat_attachment"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_message_asset_thread_idx" ON "chat_message_asset" USING btree ("thread_id","message_id");--> statement-breakpoint
CREATE INDEX "chat_message_asset_asset_idx" ON "chat_message_asset" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_attachment_pathname_unique_idx" ON "chat_attachment" USING btree ("pathname") WHERE "chat_attachment"."pathname" is not null;