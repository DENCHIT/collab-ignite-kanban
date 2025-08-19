-- Create storage bucket for comment attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('comment-attachments', 'comment-attachments', false);

-- Create policies for comment attachments
CREATE POLICY "Users can view comment attachments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'comment-attachments');

CREATE POLICY "Users can upload comment attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'comment-attachments');

CREATE POLICY "Users can update their own comment attachments" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'comment-attachments');

CREATE POLICY "Users can delete their own comment attachments" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'comment-attachments');