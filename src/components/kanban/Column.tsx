import { ReactSortable } from "react-sortablejs";
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

interface SortableIdea extends Idea {
  id: string;
  chosen?: boolean;
  selected?: boolean;
}

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
  const sortableIdeas: SortableIdea[] = ideas.map(idea => ({
    ...idea,
    id: idea.id,
  }));

  return (
    <div className="flex flex-col rounded-lg bg-card border" aria-label={`${title} column`}>
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <Badge variant="secondary">{ideas.length}</Badge>
      </div>
      <div
        className="p-2 space-y-2 min-h-[120px]"
        data-status={status}
      >
        <ReactSortable
          list={sortableIdeas}
          setList={(newList) => {
            // Let ReactSortable manage the visual updates
            console.log('setList called with:', newList.length, 'items');
          }}
          group={{
            name: "ideas",
            pull: true,
            put: true
          }}
          animation={150}
          ghostClass="opacity-50"
          chosenClass="ring-2 ring-primary"
          dragClass="rotate-3"
          forceFallback={false}
          fallbackOnBody={true}
          swapThreshold={0.65}
          onEnd={(evt) => {
            console.log('Drag ended', evt);
            console.log('From index:', evt.oldIndex, 'To index:', evt.newIndex);
            console.log('From container:', evt.from.dataset?.status);
            console.log('To container:', evt.to.dataset?.status);
            
            const id = (evt.item as HTMLElement).dataset.id;
            console.log('Item ID from dataset:', id);
            
            if (!id) {
              console.error('No ID found on dragged item');
              return;
            }
            
            const fromStatus = (evt.from as HTMLElement).dataset?.status as IdeaStatus;
            const toStatus = (evt.to as HTMLElement).dataset?.status as IdeaStatus;
            
            console.log('Moving from:', fromStatus, 'to:', toStatus);
            
            if (!toStatus) {
              console.error('No target status found');
              return;
            }
            
            // Only trigger move if actually moving to a different column
            if (fromStatus !== toStatus) {
              console.log('Calling onMove with:', id, toStatus);
              
              if (toStatus === "roadblock") {
                const reason = prompt("Reason for roadblock?") || undefined;
                onMove(id, toStatus, reason);
              } else {
                onMove(id, toStatus);
              }
            } else {
              console.log('Same column, no move needed');
            }
          }}
        >
          {sortableIdeas.map((it) => (
            <Card 
              key={it.id} 
              data-id={it.id} 
              className={`${statusClass[status]} cursor-grab active:cursor-grabbing mb-2`}
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
                  >
                    Upvote
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="flex-1 sm:flex-none" 
                    onClick={() => onVote(it.id, -1)}
                  >
                    Downvote
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1 sm:flex-none" 
                    onClick={() => onOpen(it)}
                  >
                    Details
                  </Button>
                </div>
                <div className="text-[10px]">Updated {new Date(it.lastActivityAt).toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </ReactSortable>
      </div>
    </div>
  );
}