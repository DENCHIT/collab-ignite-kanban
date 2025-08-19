import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProgressBar } from "@/components/ui/progress-bar";
import { QuickChecklist } from "@/components/ui/quick-checklist";
import { AssigneeSelector } from "@/components/ui/assignee-selector";
import { AssigneeAvatars } from "@/components/ui/assignee-avatars";
import { MoreHorizontal, ChevronUp, ChevronDown, Trash2, CheckSquare } from "lucide-react";
import { Idea, IdeaStatus, IdeaChecklistItem } from "@/types/idea";
import { getUserEmail, getUserToken } from "@/lib/session";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const statusClass: Record<IdeaStatus, string> = {
  backlog: "border-l-4 border-l-muted",
  discussion: "border-l-4 border-l-accent",
  production: "border-l-4 border-l-primary",
  review: "border-l-4 border-l-ring",
  roadblock: "border-l-4 border-l-destructive",
  done: "border-l-4 border-l-primary",
};

const statusOptions: { value: IdeaStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "discussion", label: "Discussion" },
  { value: "production", label: "Production" },
  { value: "review", label: "Review" },
  { value: "roadblock", label: "Roadblock" },
  { value: "done", label: "Done" },
];

export function Column({
  title,
  status,
  ideas,
  onMove,
  onVote,
  onOpen,
  onDelete,
  boardSlug,
  onUpdateIdea,
}: {
  title: string;
  status: IdeaStatus;
  ideas: Idea[];
  onMove: (id: string, to: IdeaStatus, reason?: string) => void;
  onVote: (id: string, delta: 1 | -1) => void;
  onOpen: (idea: Idea) => void;
  onDelete: (id: string) => void;
  boardSlug?: string;
  onUpdateIdea?: (updatedIdea: Idea) => void;
}) {
  const [isManager, setIsManager] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isUserAdmin = userEmail === "ed@zoby.ai";

  useEffect(() => {
    async function checkManagerStatus() {
      if (!boardSlug || isUserAdmin) return;
      
      const userEmail = getUserEmail();
      if (!userEmail) return;
      
      const { data, error } = await supabase.rpc('is_board_manager', {
        _board_slug: boardSlug,
        _user_email: userEmail
      });
      
      if (!error && data === true) {
        setIsManager(true);
      }
    }
    
    checkManagerStatus();
  }, [boardSlug, isUserAdmin]);

  const canManageBoard = isUserAdmin || isManager;

  const getUserVote = (idea: Idea): number | undefined => {
    const token = getUserToken();
    return idea.voters[token];
  };

  const getChecklistProgress = (idea: Idea) => {
    const totalItems = idea.checklist.length;
    const completedItems = idea.checklist.filter(item => item.completed).length;
    return { completed: completedItems, total: totalItems };
  };

  const handleChecklistUpdate = async (idea: Idea, newChecklist: IdeaChecklistItem[]) => {
    try {
      const updatedIdea = {
        ...idea,
        checklist: newChecklist,
        lastActivityAt: new Date().toISOString(),
      };

      // Update in database
      const { error } = await supabase
        .from('ideas')
        .update({ 
          checklist: JSON.parse(JSON.stringify(newChecklist)),
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', idea.id);

      if (error) throw error;

      // Update parent state if callback provided
      onUpdateIdea?.(updatedIdea);
    } catch (error) {
      console.error("Error updating checklist:", error);
    }
  };

  const handleMove = (ideaId: string, toStatus: IdeaStatus) => {
    if (toStatus === "roadblock") {
      const reason = prompt("Reason for roadblock?") || undefined;
      onMove(ideaId, toStatus, reason);
    } else {
      onMove(ideaId, toStatus);
    }
  };

  return (
    <div className="flex flex-col rounded-lg bg-card border" aria-label={`${title} column`}>
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <Badge variant="secondary">{ideas.length}</Badge>
      </div>
      <ScrollArea className="h-80 p-2">
        <div className="space-y-2">
          {ideas.map((idea) => (
            <Card 
              key={idea.id} 
              className={`${statusClass[status]} mb-2 relative`}
            >
              <CardHeader className="p-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm flex-1">{idea.title}</CardTitle>
                  {canManageBoard && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-50 bg-popover border shadow-md">
                        {statusOptions
                          .filter(option => option.value !== status)
                          .map(option => (
                            <DropdownMenuItem
                              key={option.value}
                              onClick={() => handleMove(idea.id, option.value)}
                              className="cursor-pointer"
                            >
                              Move to {option.label}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 text-xs text-muted-foreground space-y-2">
                <div className="flex items-center justify-between">
                  <div>by {idea.creatorName}</div>
                  <div className="flex items-center gap-1">
                    <Badge variant={idea.status === "roadblock" ? "destructive" : "secondary"}>
                      Score {idea.score}
                    </Badge>
                  </div>
                </div>
                
                {/* Checklist Progress Bar */}
                {idea.checklist.length > 0 && (
                  <div className="space-y-2">
                    <ProgressBar 
                      value={getChecklistProgress(idea).completed} 
                      max={getChecklistProgress(idea).total} 
                      size="sm"
                    />
                  </div>
                )}
                
                <div className="flex flex-wrap items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="secondary"
                    className={`flex-1 sm:flex-none ${
                      getUserVote(idea) === 1 ? 'bg-vote-active text-vote-active-foreground hover:bg-vote-active/80' : ''
                    }`}
                    onClick={() => onVote(idea.id, 1)}
                  >
                    <ChevronUp className="h-3 w-3 mr-1" />
                    {getUserVote(idea) === 1 ? "Upvoted" : "Upvote"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary"
                    className={`flex-1 sm:flex-none ${
                      getUserVote(idea) === -1 ? 'bg-vote-active text-vote-active-foreground hover:bg-vote-active/80' : ''
                    }`}
                    onClick={() => onVote(idea.id, -1)}
                  >
                    <ChevronDown className="h-3 w-3 mr-1" />
                    {getUserVote(idea) === -1 ? "Downvoted" : "Downvote"}
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1 sm:flex-none" 
                    onClick={() => onOpen(idea)}
                  >
                    Details
                  </Button>
                </div>
                
                {/* Quick Checklist Access */}
                <div className="flex items-center justify-between">
                  <QuickChecklist
                    items={idea.checklist}
                    onItemsChange={(newChecklist) => handleChecklistUpdate(idea, newChecklist)}
                  />
                  {idea.checklist.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {getChecklistProgress(idea).completed}/{getChecklistProgress(idea).total} completed
                    </span>
                  )}
                </div>
                <div className="text-[10px]">Updated {new Date(idea.lastActivityAt).toLocaleString()}</div>
              </CardContent>
              {canManageBoard && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute bottom-2 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(idea.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}