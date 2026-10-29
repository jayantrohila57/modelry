ALTER TABLE "asset_chunk" DROP CONSTRAINT "asset_chunk_asset_id_chat_attachment_id_fk";
--> statement-breakpoint
ALTER TABLE "asset_chunk" DROP CONSTRAINT "asset_chunk_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "asset_chunk" ADD CONSTRAINT "asset_chunk_asset_owner_fk" FOREIGN KEY ("asset_id","user_id") REFERENCES "public"."chat_attachment"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_attachment_user_category_idx" ON "chat_attachment" USING btree ("user_id","category","created_at");--> statement-breakpoint
CREATE INDEX "chat_attachment_user_file_type_idx" ON "chat_attachment" USING btree ("user_id","file_type");--> statement-breakpoint
CREATE INDEX "chat_attachment_user_folder_idx" ON "chat_attachment" USING btree ("user_id","folder_id");--> statement-breakpoint
CREATE INDEX "chat_attachment_user_processing_idx" ON "chat_attachment" USING btree ("user_id","processing_status");--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD CONSTRAINT "chat_attachment_id_user_unique" UNIQUE("id","user_id");