import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProgressBar } from "@/components/ui/progress-bar";
import { QuickChecklist } from "@/components/ui/quick-checklist";
import { AssigneeSelector } from "@/components/ui/assignee-selector";
import { AssigneeAvatars } from "@/components/ui/assignee-avatars";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, ChevronUp, ChevronDown, Trash2, CheckSquare, Edit2, Check, X } from "lucide-react";
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

const getStatusOptions = (columnNames?: Record<IdeaStatus, string>): { value: IdeaStatus; label: string }[] => [
  { value: "backlog", label: columnNames?.backlog || "Backlog" },
  { value: "discussion", label: columnNames?.discussion || "Discussion" },
  { value: "production", label: columnNames?.production || "Production" },
  { value: "review", label: columnNames?.review || "Review" },
  { value: "roadblock", label: columnNames?.roadblock || "Roadblock" },
  { value: "done", label: columnNames?.done || "Done" },
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
  onUpdateColumnName,
  columnNames,
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
  onUpdateColumnName?: (status: IdeaStatus, newName: string) => void;
  columnNames?: Record<IdeaStatus, string>;
}) {
  const [isManagerOrAssistant, setIsManagerOrAssistant] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [boardMembers, setBoardMembers] = useState<Array<{ email: string; display_name: string }>>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title);

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

  // Check if current user is an admin via role table
  useEffect(() => {
    const checkAdmin = async () => {
      if (!userEmail) return;
      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_email: userEmail,
          _role: 'admin' as any,
        });
        if (!error) setIsAdmin(!!data);
      } catch (e) {
        console.error('Error checking admin role:', e);
      }
    };
    checkAdmin();
  }, [userEmail]);

  const isUserAdmin = isAdmin || userEmail === "ed@zoby.ai";

  useEffect(() => {
    async function checkBoardRole() {
      setIsManagerOrAssistant(false);
      
      if (!boardSlug || !userEmail) {
        setIsManagerOrAssistant(isUserAdmin);
        return;
      }

      if (isUserAdmin) {
        setIsManagerOrAssistant(true);
        return;
      }
      
      try {
        // Check if user is manager
        const { data: managerData, error: managerError } = await supabase.rpc('is_board_manager', {
          _board_slug: boardSlug,
          _user_email: userEmail
        });
        
        if (!managerError && managerData === true) {
          setIsManagerOrAssistant(true);
          return;
        }

        // Check if user is assistant
        const { data: assistantData, error: assistantError } = await supabase.rpc('is_board_assistant', {
          _board_slug: boardSlug,
          _user_email: userEmail
        });
        
        if (!assistantError && assistantData === true) {
          setIsManagerOrAssistant(true);
        }
      } catch (error) {
        console.error('Error checking board role:', error);
      }
    }
    
    checkBoardRole();
  }, [boardSlug, isUserAdmin, userEmail]);

  // Fetch board members for assignee functionality
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

    if (boardSlug) {
      fetchBoardMembers();
    }
  }, [boardSlug]);

  const canManageBoard = isUserAdmin || isManagerOrAssistant;

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

  const handleAssigneesChange = async (idea: Idea, newAssignees: string[]) => {
    try {
      const updatedIdea = {
        ...idea,
        assignees: newAssignees,
        lastActivityAt: new Date().toISOString(),
      };

      // Update in database
      const { error } = await supabase
        .from('ideas')
        .update({ 
          assignees: JSON.parse(JSON.stringify(newAssignees)),
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', idea.id);

      if (error) throw error;

      // Update parent state if callback provided
      onUpdateIdea?.(updatedIdea);
    } catch (error) {
      console.error("Error updating assignees:", error);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg bg-card border" aria-label={`${title} column`}>
      <div className="px-3 py-2 border-b flex items-center justify-between">
        {isEditingTitle ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-sm h-6 flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdateColumnName?.(status, editTitle);
                  setIsEditingTitle(false);
                } else if (e.key === 'Escape') {
                  setEditTitle(title);
                  setIsEditingTitle(false);
                }
              }}
              onBlur={() => {
                onUpdateColumnName?.(status, editTitle);
                setIsEditingTitle(false);
              }}
              autoFocus
            />
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={() => {
                onUpdateColumnName?.(status, editTitle);
                setIsEditingTitle(false);
              }}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={() => {
                setEditTitle(title);
                setIsEditingTitle(false);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div 
            className="text-sm font-medium flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded"
            onClick={() => {
              if (onUpdateColumnName) {
                setIsEditingTitle(true);
                setEditTitle(title);
              }
            }}
          >
            {title}
            {onUpdateColumnName && <Edit2 className="h-3 w-3 opacity-50" />}
          </div>
        )}
        <Badge variant="secondary">{ideas.length}</Badge>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {ideas.map((idea) => (
            <Card 
              key={idea.id} 
              className={`${statusClass[status]} mb-2 relative`}
            >
              <CardHeader className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <CardTitle className="text-sm">{idea.title}</CardTitle>
                    {idea.assignees.length > 0 && (
                      <AssigneeAvatars 
                        assignees={idea.assignees} 
                        boardMembers={boardMembers}
                        maxVisible={2}
                        size="sm"
                      />
                    )}
                  </div>
                  {canManageBoard && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[100] bg-popover border shadow-md min-w-32">
                        {getStatusOptions(columnNames)
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
                    {getUserVote(idea) === 1 ? "Upvoted" : "Up"}
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
                    {getUserVote(idea) === -1 ? "Downvoted" : "Down"}
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