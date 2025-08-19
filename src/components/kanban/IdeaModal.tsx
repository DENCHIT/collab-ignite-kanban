import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload, UploadedFile } from "@/components/ui/file-upload";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import { WatchButton } from "@/components/ui/watch-button";
import { MentionInput } from "@/components/ui/mention-input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Idea, IdeaComment, IdeaCommentAttachment } from "@/types/idea";
import { Clock, Reply, Paperclip } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface IdeaModalProps {
  idea: Idea;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedIdea: Idea) => void;
}

interface BoardMember {
  email: string;
  display_name: string;
}

export const IdeaModal = ({ idea, isOpen, onClose, onUpdate }: IdeaModalProps) => {
  const [currentComment, setCurrentComment] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const { toast } = useToast();

  // Get current user email from session
  const getCurrentUserEmail = () => {
    const userSession = localStorage.getItem('user_session');
    if (userSession) {
      try {
        const session = JSON.parse(userSession);
        return session.email || 'anonymous@example.com';
      } catch {
        return 'anonymous@example.com';
      }
    }
    return 'anonymous@example.com';
  };

  const currentUserEmail = getCurrentUserEmail();
  const isWatching = idea.watchers?.includes(currentUserEmail) || false;

  // Fetch board members for mentions
  useEffect(() => {
    const fetchBoardMembers = async () => {
      try {
        // Get board from idea (you'll need to pass boardId or slug)
        // For now, we'll create some mock data - in real implementation,
        // you'd query the board_members table
        const mockMembers = [
          { email: 'john@example.com', display_name: 'John Doe' },
          { email: 'jane@example.com', display_name: 'Jane Smith' },
          { email: 'admin@example.com', display_name: 'Admin User' },
        ];
        setBoardMembers(mockMembers);
      } catch (error) {
        console.error('Failed to fetch board members:', error);
      }
    };

    if (isOpen) {
      fetchBoardMembers();
    }
  }, [isOpen]);

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

  const handleToggleWatch = async () => {
    try {
      const newWatchers = isWatching 
        ? idea.watchers.filter(email => email !== currentUserEmail)
        : [...(idea.watchers || []), currentUserEmail];

      const updatedIdea = {
        ...idea,
        watchers: newWatchers,
      };

      // Update in database
      const { error } = await supabase
        .from('ideas')
        .update({ watchers: newWatchers })
        .eq('id', idea.id);

      if (error) throw error;

      onUpdate(updatedIdea);
    } catch (error) {
      console.error("Error toggling watch:", error);
      throw error; // Re-throw so WatchButton can handle it
    }
  };

  const handleMention = (email: string) => {
    if (!mentionedUsers.includes(email)) {
      setMentionedUsers(prev => [...prev, email]);
    }
  };

  const handleSendComment = async () => {
    if (!currentComment.trim() && uploadedFiles.length === 0) return;

    setIsUploading(true);
    try {
      // Upload files first
      const attachments = uploadedFiles.length > 0 ? await uploadFiles(uploadedFiles) : [];

      const newComment: IdeaComment = {
        id: crypto.randomUUID(),
        user: currentUserEmail,
        text: currentComment,
        attachments,
        timestamp: new Date().toISOString(),
        replyTo,
      };

      const updatedComments = [...idea.comments, newComment];
      
      // Auto-subscribe mentioned users to watch the idea
      const newWatchers = [...new Set([
        ...(idea.watchers || []),
        ...mentionedUsers,
        currentUserEmail, // Auto-watch when commenting
      ])];

      const updatedIdea = {
        ...idea,
        comments: updatedComments,
        lastActivityAt: new Date().toISOString(),
        watchers: newWatchers,
      };

      // Update in database
      const { error } = await supabase
        .from('ideas')
        .update({ 
          comments: JSON.parse(JSON.stringify(updatedComments)),
          last_activity_at: new Date().toISOString(),
          watchers: newWatchers,
        })
        .eq('id', idea.id);

      if (error) throw error;

      // Create notifications for watchers
      if (idea.watchers && idea.watchers.length > 0) {
        const notifications = idea.watchers
          .filter(email => email !== currentUserEmail) // Don't notify yourself
          .map(email => ({
            user_email: email,
            idea_id: idea.id,
            type: mentionedUsers.includes(email) ? 'mention' : 'comment',
            message: mentionedUsers.includes(email) 
              ? `${currentUserEmail} mentioned you in "${idea.title}"`
              : `${currentUserEmail} commented on "${idea.title}"`,
          }));

        if (notifications.length > 0) {
          await supabase
            .from('notifications')
            .insert(notifications);
        }
      }

      onUpdate(updatedIdea);
      setCurrentComment("");
      setUploadedFiles([]);
      setReplyTo(null);
      setMentionedUsers([]);
    } catch (error) {
      console.error("Error sending comment:", error);
      toast({
        title: "Error",
        description: "Failed to send comment",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Create all activity entries including creation
  const creationEntry = {
    id: 'creation',
    user: idea.creatorName,
    text: 'created this idea',
    timestamp: idea.history.find(h => h.type === 'created')?.timestamp || idea.lastActivityAt,
    isCreation: true
  };

  const allEntries = [creationEntry, ...idea.comments.slice().reverse()];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold">{idea.title}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {idea.description}
              </DialogDescription>
            </div>
            <WatchButton 
              isWatching={isWatching}
              onToggleWatch={handleToggleWatch}
              className="ml-2"
            />
          </div>
        </DialogHeader>
        
        {/* Desktop: Side by side, Mobile: Stacked */}
        <div className="flex flex-col lg:flex-row gap-6 h-[70vh] lg:h-[60vh]">
          
          {/* Left Panel: Details & Input */}
          <div className="lg:w-1/2 flex flex-col space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="secondary">Score {idea.score}</Badge>
              <Badge>{idea.status}</Badge>
              {idea.blockedReason && <Badge variant="destructive">Blocked</Badge>}
            </div>
            
            {idea.blockedReason && (
              <div className="text-sm text-muted-foreground">
                <strong>Blocked:</strong> {idea.blockedReason}
              </div>
            )}
            
            {/* Reply indicator */}
            {replyTo && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2 flex items-center justify-between">
                <span>
                  Replying to <span className="font-medium">
                    {idea.comments.find(c => c.id === replyTo)?.user}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => setReplyTo(null)}
                >
                  ×
                </Button>
              </div>
            )}
            
            {/* Input Area */}
            <div className="flex-1 flex flex-col space-y-3">
              <h3 className="text-sm font-medium">Add Comment</h3>
              <MentionInput
                value={currentComment}
                onChange={setCurrentComment}
                onMention={handleMention}
                placeholder={replyTo ? "Write a reply... (use @ to mention someone)" : "Add a comment... (use @ to mention someone)"}
                className="resize-none min-h-[80px]"
                boardMembers={boardMembers}
              />
              
              <FileUpload
                files={uploadedFiles}
                onFilesChange={setUploadedFiles}
                maxFiles={5}
                maxSize={10}
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              
              <div className="flex justify-between items-center">
                {replyTo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReplyTo(null)}
                  >
                    Cancel Reply
                  </Button>
                )}
                <div className="flex-1" />
                <Button 
                  size="sm" 
                  onClick={handleSendComment}
                  disabled={isUploading || (!currentComment.trim() && uploadedFiles.length === 0)}
                >
                  {isUploading ? "Posting..." : replyTo ? "Reply" : "Send"}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Right Panel: Discussion */}
          <div className="lg:w-1/2 flex flex-col bg-muted/30 rounded-lg p-4">
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
                            {'isCreation' in entry ? 'created' : 'commented'} • {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                          </span>
                          {!('isCreation' in entry) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setReplyTo(entry.id)}
                            >
                              <Reply className="h-3 w-3 mr-1" />
                              Reply
                            </Button>
                          )}
                        </div>
                        
                        {'isCreation' in entry ? (
                          <div className="text-sm text-muted-foreground">
                            Created this idea
                          </div>
                        ) : (
                          <div className="bg-background rounded-lg px-3 py-2 border">
                            <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
                            
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
};