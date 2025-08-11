import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Idea } from "@/types/idea";
import { useState } from "react";
import { getDisplayName } from "@/lib/session";

export function IdeaModal({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const [comment, setComment] = useState("");
  if (!idea) return null;

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
                <div key={c.id} className="text-sm">
                  <span className="font-medium">{c.user}</span>: {c.text}
                  <span className="ml-2 text-xs text-muted-foreground">{new Date(c.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="flex-1 border rounded px-2 py-1 text-sm bg-background" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment..." />
              <Button size="sm" onClick={() => {
                const me = getDisplayName() ?? "Anonymous";
                const entry = { id: crypto.randomUUID(), user: me, text: comment, timestamp: new Date().toISOString() };
                idea.comments.unshift(entry);
                setComment("");
              }}>Send</Button>
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
