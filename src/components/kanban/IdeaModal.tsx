import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUpload, UploadedFile } from "@/components/ui/file-upload";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import { WatchButton } from "@/components/ui/watch-button";
import { MentionInput } from "@/components/ui/mention-input";
import { CommentReactions } from "@/components/ui/comment-reactions";
import { Checklist } from "@/components/ui/checklist";
import { AssigneeSelector } from "@/components/ui/assignee-selector";
import { AssigneeAvatars } from "@/components/ui/assignee-avatars";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Idea, IdeaComment, IdeaCommentAttachment, IdeaChecklistItem } from "@/types/idea";
import { Clock, Reply, Paperclip, CheckSquare, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface IdeaModalProps {
  idea: Idea;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedIdea: Idea) => void;
  boardSlug?: string;
}

interface BoardMember {
  email: string;
  display_name: string;
}

export const IdeaModal = ({ idea, isOpen, onClose, onUpdate, boardSlug }: IdeaModalProps) => {
  const [currentComment, setCurrentComment] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [boardId, setBoardId] = useState<string>('');
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const [localIdea, setLocalIdea] = useState<Idea>(idea); // Local state for immediate updates
  const { toast } = useToast();

  // Sync local state with prop changes
  useEffect(() => {
    setLocalIdea(idea);
  }, [idea]);

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
  const isWatching = localIdea.watchers?.includes(currentUserEmail) || false;

  // Fetch board members for mentions
  useEffect(() => {
    const fetchBoardMembers = async () => {
      if (!boardSlug) return;
      
      try {
        // First get the board ID
        const { data: board, error: boardError } = await supabase
          .from('boards')
          .select('id')
          .eq('slug', boardSlug)
          .single();

        if (boardError) {
          console.error('Error fetching board:', boardError);
          return;
        }

        setBoardId(board.id);

        // Then get board members for this board
        const { data: members, error: membersError } = await supabase
          .from('board_members')
          .select('email, display_name')
          .eq('board_id', board.id);

        if (membersError) {
          console.error('Error fetching board members:', membersError);
          return;
        }

        setBoardMembers(members || []);
      } catch (error) {
        console.error('Failed to fetch board members:', error);
      }
    };

    if (isOpen && boardSlug) {
      fetchBoardMembers();
    }
  }, [isOpen, boardSlug]);

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
        ? localIdea.watchers.filter(email => email !== currentUserEmail)
        : [...(localIdea.watchers || []), currentUserEmail];

      const updatedIdea = {
        ...localIdea,
        watchers: newWatchers,
      };

      // Update local state immediately
      setLocalIdea(updatedIdea);

      // Update in database
      const { error } = await supabase
        .from('ideas')
        .update({ watchers: newWatchers })
        .eq('id', localIdea.id);

      if (error) throw error;

      onUpdate(updatedIdea);
    } catch (error) {
      console.error("Error toggling watch:", error);
      // Revert local state on error
      setLocalIdea(localIdea);
      throw error; // Re-throw so WatchButton can handle it
    }
  };

  const handleMention = (email: string) => {
    if (!mentionedUsers.includes(email)) {
      setMentionedUsers(prev => [...prev, email]);
    }
  };

  const handleReaction = async (commentId: string, emoji: string) => {
    try {
      const comment = localIdea.comments.find(c => c.id === commentId);
      if (!comment) return;

      const reactions = comment.reactions || {};
      const currentUsers = reactions[emoji] || [];
      
      let newUsers: string[];
      if (currentUsers.includes(currentUserEmail)) {
        // Remove reaction
        newUsers = currentUsers.filter(email => email !== currentUserEmail);
      } else {
        // Add reaction
        newUsers = [...currentUsers, currentUserEmail];
      }

      // Update reactions
      const newReactions = { ...reactions };
      if (newUsers.length === 0) {
        delete newReactions[emoji];
      } else {
        newReactions[emoji] = newUsers;
      }

      // Update comment
      const updatedComment = { ...comment, reactions: newReactions };
      const updatedComments = localIdea.comments.map(c => 
        c.id === commentId ? updatedComment : c
      );

      const updatedIdea = {
        ...localIdea,
        comments: updatedComments,
        lastActivityAt: new Date().toISOString(),
      };

      // Update local state immediately for instant UI feedback
      setLocalIdea(updatedIdea);

      // Update in database (background)
      const { error } = await supabase
        .from('ideas')
        .update({ 
          comments: JSON.parse(JSON.stringify(updatedComments)),
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', localIdea.id);

      if (error) {
        // Revert on error
        setLocalIdea(localIdea);
        throw error;
      }

      onUpdate(updatedIdea);
    } catch (error) {
      console.error("Error updating reaction:", error);
      toast({
        title: "Error",
        description: "Failed to update reaction",
        variant: "destructive",
      });
    }
  };

  const extractMentionsFromHtml = (html: string) => {
    const mentions: string[] = [];
    boardMembers.forEach(member => {
      if (html.includes(`@${member.display_name}`)) {
        mentions.push(member.email);
      }
    });
    return mentions;
  };

  const handleChecklistUpdate = async (newChecklist: IdeaChecklistItem[]) => {
    try {
      const updatedIdea = {
        ...localIdea,
        checklist: newChecklist,
        lastActivityAt: new Date().toISOString(),
      };

      // Update local state immediately
      setLocalIdea(updatedIdea);

      // Update in database
      const { error } = await supabase
        .from('ideas')
        .update({ 
          checklist: JSON.parse(JSON.stringify(newChecklist)),
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', localIdea.id);

      if (error) {
        // Revert local state on error
        setLocalIdea(localIdea);
        throw error;
      }

      onUpdate(updatedIdea);
    } catch (error) {
      console.error("Error updating checklist:", error);
      toast({
        title: "Error",
        description: "Failed to update checklist",
        variant: "destructive",
      });
    }
  };

  const handleAssigneesChange = async (newAssignees: string[]) => {
    try {
      const updatedIdea = {
        ...localIdea,
        assignees: newAssignees,
        lastActivityAt: new Date().toISOString(),
      };

      // Update local state immediately
      setLocalIdea(updatedIdea);

      // Update in database
      const { error } = await supabase
        .from('ideas')
        .update({ 
          assignees: JSON.parse(JSON.stringify(newAssignees)),
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', localIdea.id);

      if (error) {
        // Revert local state on error
        setLocalIdea(localIdea);
        throw error;
      }

      onUpdate(updatedIdea);
    } catch (error) {
      console.error("Error updating assignees:", error);
      toast({
        title: "Error",
        description: "Failed to update assignees",
        variant: "destructive",
      });
    }
  };

  const handleSendComment = async () => {
    if (!currentComment.trim() && uploadedFiles.length === 0) return;

    setIsUploading(true);
    try {
      // Extract mentions from rich text content
      const extractedMentions = extractMentionsFromHtml(currentComment);
      const allMentions = [...new Set([...mentionedUsers, ...extractedMentions])];

      // Upload files first
      const attachments = uploadedFiles.length > 0 ? await uploadFiles(uploadedFiles) : [];

      const newComment: IdeaComment = {
        id: crypto.randomUUID(),
        user: currentUserEmail,
        text: currentComment, // This will be HTML from rich text editor
        content: currentComment, // Store HTML in content field
        attachments,
        timestamp: new Date().toISOString(),
        replyTo,
        reactions: {}, // Initialize empty reactions
      };

      const updatedComments = [...localIdea.comments, newComment];
      
      // Auto-subscribe mentioned users to watch the idea
      const newWatchers = [...new Set([
        ...(localIdea.watchers || []),
        ...allMentions,
        currentUserEmail, // Auto-watch when commenting
      ])];

      const updatedIdea = {
        ...localIdea,
        comments: updatedComments,
        lastActivityAt: new Date().toISOString(),
        watchers: newWatchers,
      };

      // Update local state immediately
      setLocalIdea(updatedIdea);

      // Update in database
      const { error } = await supabase
        .from('ideas')
        .update({ 
          comments: JSON.parse(JSON.stringify(updatedComments)),
          last_activity_at: new Date().toISOString(),
          watchers: newWatchers,
        })
        .eq('id', localIdea.id);

      if (error) throw error;

      // Create notifications for watchers
      if (localIdea.watchers && localIdea.watchers.length > 0) {
        const notifications = localIdea.watchers
          .filter(email => email !== currentUserEmail) // Don't notify yourself
          .map(email => ({
            user_email: email,
            idea_id: localIdea.id,
            type: allMentions.includes(email) ? 'mention' : 'comment',
            message: allMentions.includes(email) 
              ? `${currentUserEmail} mentioned you in "${localIdea.title}"`
              : `${currentUserEmail} commented on "${localIdea.title}"`,
          }));

        if (notifications.length > 0) {
          await supabase
            .from('notifications')
            .insert(notifications);
        }
      }

        // Send email notifications for mentions
        if (allMentions.length > 0) {
          try {
            await supabase.functions.invoke('email-notifications', {
              body: {
                event_type: 'mention',
                board_id: boardId,
                idea_id: localIdea.id,
                actor_email: currentUserEmail,
                recipients: allMentions
              }
            });
          } catch (error) {
            console.error('Failed to send email notifications:', error);
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
    user: localIdea.creatorName,
    text: 'created this idea',
    timestamp: localIdea.history.find(h => h.type === 'created')?.timestamp || localIdea.lastActivityAt,
    isCreation: true
  };

  const allEntries = [creationEntry, ...localIdea.comments.slice().reverse()];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold">{localIdea.title}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {localIdea.description}
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
              <Badge variant="secondary">Score {localIdea.score}</Badge>
              <Badge>{localIdea.status}</Badge>
              {localIdea.blockedReason && <Badge variant="destructive">Blocked</Badge>}
              {localIdea.checklist.length > 0 && (
                <Badge variant="outline">
                  <CheckSquare className="h-3 w-3 mr-1" />
                  {localIdea.checklist.filter(item => item.completed).length}/{localIdea.checklist.length}
                </Badge>
              )}
            </div>

            {/* Assignees Section */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Assignees</span>
              </div>
              <AssigneeSelector
                assignees={localIdea.assignees}
                boardMembers={boardMembers}
                onAssigneesChange={handleAssigneesChange}
              />
            </div>
            
            {localIdea.blockedReason && (
              <div className="text-sm text-muted-foreground">
                <strong>Blocked:</strong> {localIdea.blockedReason}
              </div>
            )}

            {/* Checklist Section */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                <h3 className="text-sm font-medium">Checklist</h3>
                <Badge variant="secondary">{localIdea.checklist.length}</Badge>
              </div>
              
              <Checklist
                items={localIdea.checklist}
                onItemsChange={handleChecklistUpdate}
                showProgress={true}
                className="max-h-48 overflow-y-auto"
              />
            </div>

            <Separator />
            
            {/* Reply indicator */}
            {replyTo && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2 flex items-center justify-between">
                <span>
                  Replying to <span className="font-medium">
                    {localIdea.comments.find(c => c.id === replyTo)?.user}
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
            <div className="flex flex-col space-y-3">
              <h3 className="text-sm font-medium">Add Comment</h3>
              <MentionInput
                value={currentComment}
                onChange={setCurrentComment}
                onMention={(email) => {
                  if (!mentionedUsers.includes(email)) {
                    setMentionedUsers([...mentionedUsers, email]);
                  }
                }}
                boardMembers={boardMembers}
                placeholder={replyTo ? "Write a reply... (use @ to mention someone)" : "Add a comment... (use @ to mention someone)"}
                className="min-h-[120px]"
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
                  ? localIdea.comments.find(comment => comment.id === entry.replyTo) 
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
                            <div 
                              className="text-sm prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: entry.content || entry.text }}
                            />
                            
                            {/* Reactions */}
                            <CommentReactions
                              reactions={entry.reactions}
                              onReact={(emoji) => handleReaction(entry.id, emoji)}
                              currentUserEmail={currentUserEmail}
                              className="mt-2"
                            />
                            
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