import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Idea, IdeaCommentAttachment } from "@/types/idea";
import { useState } from "react";
import { getDisplayName } from "@/lib/session";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { FileUpload, UploadedFile } from "@/components/ui/file-upload";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function IdeaModal({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  if (!idea) return null;

  const uploadFiles = async (files: UploadedFile[]): Promise<IdeaCommentAttachment[]> => {
    const attachments: IdeaCommentAttachment[] = [];
    
    for (const file of files) {
      const fileName = `${crypto.randomUUID()}-${file.file.name}`;
      const filePath = `comments/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('comment-attachments')
        .upload(filePath, file.file);
        
      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.file.name}`,
          variant: "destructive"
        });
        continue;
      }
      
      const { data: urlData } = supabase.storage
        .from('comment-attachments')
        .getPublicUrl(filePath);
        
      attachments.push({
        id: crypto.randomUUID(),
        name: file.file.name,
        size: file.file.size,
        type: file.file.type,
        url: urlData.publicUrl
      });
    }
    
    return attachments;
  };

  const handleSendComment = async () => {
    if (!comment.trim() && files.length === 0) {
      toast({
        title: "Empty comment",
        description: "Please add some text or attach files"
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      const attachments = files.length > 0 ? await uploadFiles(files) : [];
      
      const me = getDisplayName() ?? "Anonymous";
      const entry = { 
        id: crypto.randomUUID(), 
        user: me, 
        text: comment.replace(/<[^>]*>/g, '').trim(), // Plain text fallback
        content: comment, // Rich text content
        attachments,
        timestamp: new Date().toISOString() 
      };
      
      idea.comments.unshift(entry);
      setComment("");
      setFiles([]);
      
      toast({
        title: "Comment added",
        description: "Your comment has been posted"
      });
    } catch (error) {
      console.error('Error posting comment:', error);
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={!!idea} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{idea.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {idea.description && (
            <p className="text-sm text-muted-foreground">{idea.description}</p>
          )}
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="secondary">Score {idea.score}</Badge>
            <Badge>{idea.status}</Badge>
            {idea.blockedReason && <Badge variant="destructive">Blocked</Badge>}
          </div>
          {idea.blockedReason && (
            <div className="text-sm">Reason: {idea.blockedReason}</div>
          )}
          <div>
            <h3 className="text-sm font-medium mb-2">Comments</h3>
            <div className="space-y-2 max-h-40 overflow-auto">
              {idea.comments.length === 0 && (
                <div className="text-sm text-muted-foreground">No comments yet</div>
              )}
              {idea.comments.map((c) => (
                <div key={c.id} className="text-sm border-b border-border/50 pb-3 mb-3 last:border-b-0 last:pb-0 last:mb-0">
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-medium">{c.user}</span>
                    <span className="text-xs text-muted-foreground">{new Date(c.timestamp).toLocaleString()}</span>
                  </div>
                  {c.content ? (
                    <div 
                      className="prose prose-sm max-w-none" 
                      dangerouslySetInnerHTML={{ __html: c.content }}
                    />
                  ) : (
                    <p>{c.text}</p>
                  )}
                  {c.attachments && c.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {c.attachments
                          .filter(att => att.type.startsWith('image/'))
                          .map((attachment) => (
                            <AttachmentPreview 
                              key={attachment.id} 
                              attachment={attachment} 
                              showThumbnail 
                            />
                          ))}
                      </div>
                      {c.attachments
                        .filter(att => !att.type.startsWith('image/'))
                        .map((attachment) => (
                          <AttachmentPreview 
                            key={attachment.id} 
                            attachment={attachment} 
                          />
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-3">
              <RichTextEditor
                content={comment}
                onChange={setComment}
                placeholder="Write a comment..."
              />
              <FileUpload
                files={files}
                onFilesChange={setFiles}
                maxFiles={5}
                maxSize={10}
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <div className="flex justify-end">
                <Button 
                  size="sm" 
                  onClick={handleSendComment}
                  disabled={isUploading}
                >
                  {isUploading ? "Posting..." : "Send"}
                </Button>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">History</h3>
            <div className="space-y-1 max-h-48 overflow-auto text-sm">
              {idea.history.map((h) => (
                <div key={h.id} className="text-muted-foreground">
                  <span className="text-foreground font-medium">{h.user}</span> {h.type}
                  {h.from && h.to && (
                    <>
                      {" "}from <Badge variant="secondary">{h.from}</Badge> to <Badge variant="secondary">{h.to}</Badge>
                    </>
                  )}
                  {h.details && <> — {h.details}</>}
                  <span className="ml-2 text-xs">{new Date(h.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
