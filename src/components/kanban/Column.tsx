import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Idea, IdeaStatus } from "@/types/idea";
import { isAdmin, getUserEmail } from "@/lib/session";
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
  boardSlug,
}: {
  title: string;
  status: IdeaStatus;
  ideas: Idea[];
  onMove: (id: string, to: IdeaStatus, reason?: string) => void;
  onVote: (id: string, delta: 1 | -1) => void;
  onOpen: (idea: Idea) => void;
  boardSlug?: string;
}) {
  const isUserAdmin = isAdmin();
  const [isManager, setIsManager] = useState(false);

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
      <div className="p-2 space-y-2 min-h-[120px]">
        {ideas.map((idea) => (
          <Card 
            key={idea.id} 
            className={`${statusClass[status]} mb-2`}
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
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="flex-1 sm:flex-none" 
                  onClick={() => onVote(idea.id, 1)}
                >
                  Upvote
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="flex-1 sm:flex-none" 
                  onClick={() => onVote(idea.id, -1)}
                >
                  Downvote
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1 sm:flex-none" 
                  onClick={() => onOpen(idea)}
                >
                  Details
                </Button>
              </div>
              <div className="text-[10px]">Updated {new Date(idea.lastActivityAt).toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}