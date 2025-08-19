-- Update bucket to be public for easier access to attachments
UPDATE storage.buckets 
SET public = true 
WHERE name = 'comment-attachments';