import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Idea, IdeaCommentAttachment, IdeaComment } from "@/types/idea";
import { useState } from "react";
import { getDisplayName } from "@/lib/session";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { FileUpload, UploadedFile } from "@/components/ui/file-upload";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type ActivityEntry = IdeaComment | {
  id: string;
  user: string;
  text: string;
  timestamp: string;
  isCreation: true;
};

export function IdeaModal({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  
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
        timestamp: new Date().toISOString(),
        replyTo: replyingTo || undefined
      };
      
      // Add to local state
      idea.comments.unshift(entry);
      
      // Save to database
      const { error } = await supabase
        .from('ideas')
        .update({ 
          comments: idea.comments as any,
          last_activity_at: new Date().toISOString()
        })
        .eq('id', idea.id);
        
      if (error) {
        console.error('Error saving comment:', error);
        toast({
          title: "Save failed", 
          description: "Comment posted but not saved to database",
          variant: "destructive"
        });
      }
      
      setComment("");
      setFiles([]);
      setReplyingTo(null);
      
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

  // Get creation info from history
  const creationEntry = idea.history.find(h => h.type === 'created');
  const allEntries = [
    ...(creationEntry ? [{
      id: 'creation',
      user: creationEntry.user,
      text: 'created this idea',
      timestamp: creationEntry.timestamp,
      isCreation: true
    }] : []),
    ...idea.comments.slice().reverse()
  ];

  return (
    <Dialog open={!!idea} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{idea.title}</DialogTitle>
        </DialogHeader>
        
        {/* Desktop: Side by side, Mobile: Stacked */}
        <div className="flex flex-col lg:flex-row gap-6 h-[70vh] lg:h-[60vh]">
          
          {/* Left Panel: Details & Input */}
          <div className="lg:w-1/2 flex flex-col space-y-4">
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
            
            {/* Reply indicator */}
            {replyingTo && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2 flex items-center justify-between">
                <span>
                  Replying to <span className="font-medium">
                    {idea.comments.find(c => c.id === replyingTo)?.user}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => setReplyingTo(null)}
                >
                  ×
                </Button>
              </div>
            )}
            
            {/* Input Area */}
            <div className="flex-1 flex flex-col space-y-3">
              <h3 className="text-sm font-medium">Add Comment</h3>
              <div className="flex-1 flex flex-col space-y-3">
                <RichTextEditor
                  content={comment}
                  onChange={setComment}
                  placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                />
                <FileUpload
                  files={files}
                  onFilesChange={setFiles}
                  maxFiles={5}
                  maxSize={10}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                <div className="flex justify-between items-center">
                  {replyingTo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplyingTo(null)}
                    >
                      Cancel Reply
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button 
                    size="sm" 
                    onClick={handleSendComment}
                    disabled={isUploading}
                  >
                    {isUploading ? "Posting..." : replyingTo ? "Reply" : "Send"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Panel: Discussion */}
          <div className="lg:w-1/2 flex flex-col">
            <h3 className="text-sm font-medium mb-3">Activity</h3>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {allEntries.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No activity yet. Start the discussion!
                </div>
              )}
              
              {allEntries.map((entry) => {
                const isComment = 'content' in entry || 'attachments' in entry;
                const repliedComment = isComment && 'replyTo' in entry && entry.replyTo 
                  ? idea.comments.find(comment => comment.id === entry.replyTo) 
                  : null;
                
                return (
                  <div key={entry.id} className="group">
                    {/* Replied to indicator */}
                    {repliedComment && (
                      <div className="ml-4 mb-1 text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1 border-l-2 border-muted">
                        Replying to <span className="font-medium">{repliedComment.user}</span>: {repliedComment.text.slice(0, 50)}{repliedComment.text.length > 50 ? '...' : ''}
                      </div>
                    )}
                    
                    {/* Activity Entry */}
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-primary">{entry.user.charAt(0).toUpperCase()}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{entry.user}</span>
                          <span className="text-xs text-muted-foreground">
                            {'isCreation' in entry ? 'created' : 'commented'} • {new Date(entry.timestamp).toLocaleString()}
                          </span>
                          {!('isCreation' in entry) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setReplyingTo(entry.id)}
                            >
                              Reply
                            </Button>
                          )}
                        </div>
                        
                        {'isCreation' in entry ? (
                          <div className="text-sm text-muted-foreground">
                            Created this idea
                          </div>
                        ) : (
                          <div className="bg-muted/50 rounded-lg px-3 py-2">
                            {'content' in entry && entry.content ? (
                              <div 
                                className="prose prose-sm max-w-none text-sm" 
                                dangerouslySetInnerHTML={{ __html: entry.content }}
                              />
                            ) : (
                              <p className="text-sm">{entry.text}</p>
                            )}
                            
                            {/* Attachments */}
                            {'attachments' in entry && entry.attachments && entry.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  {entry.attachments
                                    .filter(att => att.type.startsWith('image/'))
                                    .map((attachment) => (
                                      <AttachmentPreview 
                                        key={attachment.id} 
                                        attachment={attachment} 
                                        showThumbnail 
                                      />
                                    ))}
                                </div>
                                {entry.attachments
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
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
