ALTER TABLE "chat_message" ADD COLUMN "parts" jsonb DEFAULT '[]'::jsonb NOT NULL;

UPDATE "chat_message"
SET "parts" =
  CASE
    WHEN "reasoning" IS NOT NULL AND btrim("reasoning") <> ''
      THEN jsonb_build_array(jsonb_build_object('type', 'reasoning', 'text', "reasoning"))
    ELSE '[]'::jsonb
  END
  || CASE
    WHEN "content" <> ''
      THEN jsonb_build_array(jsonb_build_object('type', 'text', 'text', "content"))
    ELSE '[]'::jsonb
  END
WHERE "parts" = '[]'::jsonb;
