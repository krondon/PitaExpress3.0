
-- Make receiver_role and receiver_id nullable to support group messages
ALTER TABLE chat_messages ALTER COLUMN receiver_role DROP NOT NULL;
ALTER TABLE chat_messages ALTER COLUMN receiver_id DROP NOT NULL;
