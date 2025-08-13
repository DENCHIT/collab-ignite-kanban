import { useEffect, useRef, useState } from "react";
import Sortable from "sortablejs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Idea, IdeaStatus } from "@/types/idea";

const statusClass: Record<IdeaStatus, string> = {
  backlog: "border-l-4 border-l-muted",
  discussion: "border-l-4 border-l-accent",
  production: "border-l-4 border-l-primary",
  review: "border-l-4 border-l-ring",
  roadblock: "border-l-4 border-l-destructive",
  done: "border-l-4 border-l-primary",
};

export function Column({
  title,
  status,
  ideas,
  onMove,
  onVote,
  onOpen,
}: {
  title: string;
  status: IdeaStatus;
  ideas: Idea[];
  onMove: (id: string, to: IdeaStatus, reason?: string) => void;
  onVote: (id: string, delta: 1 | -1) => void;
  onOpen: (idea: Idea) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const sortableRef = useRef<Sortable | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragKey, setDragKey] = useState(0);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current;
    
    // Destroy previous sortable instance
    if (sortableRef.current) {
      sortableRef.current.destroy();
    }
    
    sortableRef.current = new Sortable(el, {
      group: "ideas",
      animation: 150,
      ghostClass: "opacity-50",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      forceFallback: true,
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onStart: () => {
        setIsDragging(true);
      },
      onEnd: (evt) => {
        const id = (evt.item as HTMLElement).dataset.id;
        if (!id) return;
        const to = (evt.to as HTMLElement).dataset.status as IdeaStatus;
        
        setIsDragging(false);
        
        // Force React to recreate the list after drag operation
        setDragKey(prev => prev + 1);
        
        // Use requestAnimationFrame to ensure DOM operations complete
        requestAnimationFrame(() => {
          if (to === "roadblock") {
            const reason = prompt("Reason for roadblock?") || undefined;
            onMove(id, to, reason);
          } else {
            onMove(id, to);
          }
        });
      },
    });
    
    return () => {
      if (sortableRef.current) {
        sortableRef.current.destroy();
        sortableRef.current = null;
      }
    };
  }, [onMove, dragKey]);

  return (
    <div className="flex flex-col rounded-lg bg-card border" aria-label={`${title} column`}>
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <Badge variant="secondary">{ideas.length}</Badge>
      </div>
      <div 
        ref={listRef} 
        data-status={status} 
        className="p-2 space-y-2 min-h-[120px]" 
        aria-live="polite"
        key={`${status}-${dragKey}`}
      >
        {ideas.map((it) => (
          <Card 
            key={`${it.id}-${dragKey}`} 
            data-id={it.id} 
            className={`${statusClass[status]} cursor-grab active:cursor-grabbing`}
            style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
          >
            <CardHeader className="p-3">
              <CardTitle className="text-sm">{it.title}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center justify-between">
                <div>by {it.creatorName}</div>
                <div className="flex items-center gap-1">
                  <Badge variant={it.status === "roadblock" ? "destructive" : "secondary"}>
                    Score {it.score}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="flex-1 sm:flex-none" 
                  onClick={() => onVote(it.id, 1)}
                  disabled={isDragging}
                >
                  Upvote
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="flex-1 sm:flex-none" 
                  onClick={() => onVote(it.id, -1)}
                  disabled={isDragging}
                >
                  Downvote
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1 sm:flex-none" 
                  onClick={() => onOpen(it)}
                  disabled={isDragging}
                >
                  Details
                </Button>
              </div>
              <div className="text-[10px]">Updated {new Date(it.lastActivityAt).toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
