import { useEffect, useMemo, useState } from "react";
import { Column } from "./Column";
import { FiltersBar, FiltersState } from "./FiltersBar";
import { Idea, IdeaStatus, Thresholds } from "@/types/idea";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { IdeaModal } from "./IdeaModal";
import { getDisplayName, getUserToken, loadThresholds } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const defaultThresholds: Thresholds = {
  toDiscussion: 5,
  toProduction: 10,
  toBacklog: 5,
};

const initialIdeas: Idea[] = [
  {
    id: crypto.randomUUID(),
    title: "Onboarding checklist to reduce churn",
    description: "A guided checklist after signup with progress and tooltips.",
    creatorName: "Avery",
    score: 3,
    status: "backlog",
    lastActivityAt: new Date().toISOString(),
    voters: {},
    comments: [],
    history: [
      { id: crypto.randomUUID(), type: "created", user: "Avery", timestamp: new Date().toISOString(), details: "Seed idea" },
    ],
    watchers: [],
    checklist: [],
  },
  {
    id: crypto.randomUUID(),
    title: "Dark mode",
    description: "Auto-detect system theme, toggle in settings.",
    creatorName: "Blake",
    score: 6,
    status: "discussion",
    lastActivityAt: new Date().toISOString(),
    voters: {},
    comments: [],
    history: [
      { id: crypto.randomUUID(), type: "created", user: "Blake", timestamp: new Date().toISOString() },
    ],
    watchers: [],
    checklist: [],
  },
];

export function Board({ boardSlug }: { boardSlug?: string }) {
  const [thresholds] = useState<Thresholds>(loadThresholds(defaultThresholds, boardSlug));
  const [boardName, setBoardName] = useState<string>("Team Ideas Board");
  const [boardItemType, setBoardItemType] = useState<string>("idea");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [filters, setFilters] = useState<FiltersState>({ q: "", highScore: false, recent: true, mine: false, blocked: false });
  const [activeIdea, setActiveIdea] = useState<Idea | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

  // Load board and ideas from Supabase
  useEffect(() => {
    let ignore = false;
    
    const loadBoardData = async () => {
      if (!boardSlug) {
        console.error('No board slug provided');
        setLoading(false);
        return;
      }

      try {
        // Get board ID from slug
        const { data: board, error: boardError } = await supabase
          .from('boards')
          .select('id, name, item_type')
          .eq('slug', boardSlug)
          .single();

        if (boardError) {
          console.error('Error loading board:', boardError);
          setLoading(false);
          return;
        }

        if (ignore) return;
        
        setBoardId(board.id);
        setBoardName(board.name || 'Team Ideas Board');
        setBoardItemType(board.item_type || 'idea');

        // Load ideas for this board
        const { data: ideasData, error: ideasError } = await supabase
          .from('ideas')
          .select('*')
          .eq('board_id', board.id)
          .order('created_at', { ascending: false });

        if (ideasError) {
          console.error('Error loading ideas:', ideasError);
          setLoading(false);
          return;
        }

        if (ignore) return;

        // Convert database format to frontend format
        const formattedIdeas: Idea[] = ideasData.map(dbIdea => ({
          id: dbIdea.id,
          title: dbIdea.title,
          description: dbIdea.description,
          creatorName: dbIdea.creator_name,
          score: dbIdea.score,
          status: dbIdea.status as IdeaStatus,
          lastActivityAt: dbIdea.last_activity_at,
          voters: dbIdea.voters as Record<string, number>,
          comments: dbIdea.comments as any[],
          history: dbIdea.history as any[],
          blockedReason: dbIdea.blocked_reason,
          watchers: dbIdea.watchers as string[] || [],
          checklist: dbIdea.checklist as any[] || []
        }));

        setIdeas(formattedIdeas);
        setLoading(false);
      } catch (error) {
        console.error('Error in loadBoardData:', error);
        setLoading(false);
      }
    };

    loadBoardData();
    
    return () => {
      ignore = true;
    };
  }, [boardSlug]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!boardId) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ideas',
          filter: `board_id=eq.${boardId}`
        },
        (payload) => {
          console.log('Real-time update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newIdea: Idea = {
              id: payload.new.id,
              title: payload.new.title,
              description: payload.new.description,
              creatorName: payload.new.creator_name,
              score: payload.new.score,
              status: payload.new.status as IdeaStatus,
              lastActivityAt: payload.new.last_activity_at,
              voters: payload.new.voters as Record<string, number>,
              comments: payload.new.comments as any[],
              history: payload.new.history as any[],
              blockedReason: payload.new.blocked_reason,
              watchers: payload.new.watchers as string[] || [],
              checklist: payload.new.checklist as any[] || []
            };
            setIdeas(prev => [newIdea, ...prev.filter(idea => idea.id !== newIdea.id)]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedIdea: Idea = {
              id: payload.new.id,
              title: payload.new.title,
              description: payload.new.description,
              creatorName: payload.new.creator_name,
              score: payload.new.score,
              status: payload.new.status as IdeaStatus,
              lastActivityAt: payload.new.last_activity_at,
              voters: payload.new.voters as Record<string, number>,
              comments: payload.new.comments as any[],
              history: payload.new.history as any[],
              blockedReason: payload.new.blocked_reason,
              watchers: payload.new.watchers as string[] || [],
              checklist: payload.new.checklist as any[] || []
            };
            setIdeas(prev => prev.map(idea => idea.id === updatedIdea.id ? updatedIdea : idea));
          } else if (payload.eventType === 'DELETE') {
            setIdeas(prev => prev.filter(idea => idea.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  const grouped = useMemo(() => {
    const buckets: Record<IdeaStatus, Idea[]> = {
      backlog: [],
      discussion: [],
      production: [],
      review: [],
      roadblock: [],
      done: [],
    };
    const q = filters.q.trim().toLowerCase();
    const me = getDisplayName();

    ideas
      .filter((it) => (filters.blocked ? it.status === "roadblock" : true))
      .filter((it) => (filters.mine && me ? it.creatorName === me : true))
      .filter((it) => (q ? (it.title + " " + (it.description ?? "")).toLowerCase().includes(q) : true))
      .sort((a, b) => {
        // Primary sort: Always by score (highest first)
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        
        // Secondary sort: Apply user filters as tiebreaker
        if (filters.recent) {
          return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
        }
        
        // Default tiebreaker: most recent activity
        return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
      })
      .forEach((it) => {
        if (buckets[it.status]) {
          buckets[it.status].push(it);
        }
      });

    return buckets;
  }, [ideas, filters]);

  function logHistory(idea: Idea, entry: Omit<Idea["history"][number], "id">) {
    return { ...idea, history: [{ id: crypto.randomUUID(), ...entry }, ...idea.history] } as Idea;
  }

  function autoMove(updated: Idea): Idea {
    // Auto move based on score thresholds
    if (updated.score <= -thresholds.toBacklog && updated.status !== "backlog") {
      updated = logHistory(updated, { type: "moved", user: "system", timestamp: new Date().toISOString(), from: updated.status, to: "backlog", details: "Auto demote by score" });
      return { ...updated, status: "backlog", blockedReason: undefined };
    }
    if (updated.status === "backlog" && updated.score >= thresholds.toDiscussion) {
      updated = logHistory(updated, { type: "moved", user: "system", timestamp: new Date().toISOString(), from: "backlog", to: "discussion", details: "Auto promote by score" });
      return { ...updated, status: "discussion" };
    }
    if (updated.status === "discussion" && updated.score >= thresholds.toProduction) {
      updated = logHistory(updated, { type: "moved", user: "system", timestamp: new Date().toISOString(), from: "discussion", to: "production", details: "Auto promote by score" });
      return { ...updated, status: "production" };
    }
    return updated;
  }

  async function vote(id: string, delta: 1 | -1) {
    const token = getUserToken();
    const me = getDisplayName() ?? "Anonymous";
    
    const ideaToUpdate = ideas.find(it => it.id === id);
    if (!ideaToUpdate) return;
    
    const currentVote = ideaToUpdate.voters[token];
    let updated: Idea;
    
    if (currentVote === delta) {
      // User clicked the same vote button - remove their vote
      const newVoters = { ...ideaToUpdate.voters };
      delete newVoters[token];
      
      updated = {
        ...ideaToUpdate,
        voters: newVoters,
        score: ideaToUpdate.score - currentVote,
        lastActivityAt: new Date().toISOString(),
      };
      updated = logHistory(updated, { 
        type: "voted", 
        user: me, 
        timestamp: updated.lastActivityAt, 
        delta: -currentVote, 
        details: "Removed vote" 
      });
      toast({ title: "Vote removed", description: "You can vote again if you change your mind." });
    } else if (currentVote) {
      // User is changing their vote
      updated = {
        ...ideaToUpdate,
        voters: { ...ideaToUpdate.voters, [token]: delta },
        score: ideaToUpdate.score - currentVote + delta,
        lastActivityAt: new Date().toISOString(),
      };
      updated = logHistory(updated, { 
        type: "voted", 
        user: me, 
        timestamp: updated.lastActivityAt, 
        delta: delta - currentVote, 
        details: `Changed vote from ${currentVote > 0 ? '+1' : '-1'} to ${delta > 0 ? '+1' : '-1'}` 
      });
      toast({ title: "Vote changed", description: `Changed to ${delta > 0 ? 'upvote' : 'downvote'}` });
    } else {
      // User is voting for the first time
      updated = {
        ...ideaToUpdate,
        voters: { ...ideaToUpdate.voters, [token]: delta },
        score: ideaToUpdate.score + delta,
        lastActivityAt: new Date().toISOString(),
      };
      updated = logHistory(updated, { 
        type: "voted", 
        user: me, 
        timestamp: updated.lastActivityAt, 
        delta, 
        details: delta > 0 ? "+1" : "-1" 
      });
      toast({ title: "Vote cast", description: `${delta > 0 ? 'Upvoted' : 'Downvoted'} successfully` });
    }
    
    updated = autoMove(updated);

    // Update in database
    const { error } = await supabase
      .from('ideas')
      .update({
        voters: JSON.parse(JSON.stringify(updated.voters)) as Json,
        score: updated.score,
        status: updated.status,
        last_activity_at: updated.lastActivityAt,
        history: JSON.parse(JSON.stringify(updated.history)) as Json,
        blocked_reason: updated.blockedReason
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating vote:', error);
      toast({ title: "Error", description: "Failed to save vote. Please try again." });
    }
  }

  async function move(id: string, to: IdeaStatus, reason?: string) {
    console.log('Moving idea', id, 'to', to);
    
    const ideaToUpdate = ideas.find(it => it.id === id);
    if (!ideaToUpdate) return;
    
    const from = ideaToUpdate.status;
    if (to === "done" && !isUserAdmin) {
      toast({ title: "Only admins can move to Done" });
      return;
    }
    
    let updated: Idea = { ...ideaToUpdate, status: to, lastActivityAt: new Date().toISOString() };
    if (to === "roadblock") updated.blockedReason = reason || "";
    if (from === "roadblock" && to !== "roadblock") updated.blockedReason = undefined;
    updated = logHistory(updated, { type: "moved", user: getDisplayName() ?? "Anonymous", timestamp: updated.lastActivityAt, from, to, details: reason });
    
    // Update in database
    const { error } = await supabase
      .from('ideas')
      .update({
        status: updated.status,
        last_activity_at: updated.lastActivityAt,
        history: JSON.parse(JSON.stringify(updated.history)) as Json,
        blocked_reason: updated.blockedReason
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating move:', error);
      toast({ title: "Error", description: "Failed to move idea. Please try again." });
    }
  }

  async function addIdea(title: string, description?: string) {
    if (!boardId) {
      toast({ title: "Error", description: "Board not loaded. Please try again." });
      return;
    }
    
    const me = getDisplayName() ?? "Anonymous";
    const now = new Date().toISOString();
    const newIdea: Idea = {
      id: crypto.randomUUID(),
      title,
      description,
      creatorName: me,
      score: 0,
      status: "backlog",
      lastActivityAt: now,
      voters: {},
      comments: [],
      history: [
        { id: crypto.randomUUID(), type: "created", user: me, timestamp: now },
      ],
      watchers: [],
      checklist: [],
    };
    
    // Insert into database
    const { error } = await supabase
      .from('ideas')
      .insert({
        id: newIdea.id,
        board_id: boardId,
        title: newIdea.title,
        description: newIdea.description,
        creator_name: newIdea.creatorName,
        score: newIdea.score,
        status: newIdea.status,
        last_activity_at: newIdea.lastActivityAt,
        voters: JSON.parse(JSON.stringify(newIdea.voters)) as Json,
        comments: JSON.parse(JSON.stringify(newIdea.comments)) as Json,
        history: JSON.parse(JSON.stringify(newIdea.history)) as Json,
        watchers: newIdea.watchers,
        checklist: JSON.parse(JSON.stringify(newIdea.checklist)) as Json,
      });

    if (error) {
      console.error('Error adding idea:', error);
      toast({ title: "Error", description: "Failed to add idea. Please try again." });
    }
  }

  const deleteIdea = async (ideaId: string) => {
    try {
      const { error } = await supabase
        .from('ideas')
        .delete()
        .eq('id', ideaId);

      if (error) {
        console.error('Error deleting idea:', error);
        toast({ title: "Error", description: "Failed to delete idea. Please try again." });
      } else {
        toast({ title: "Success", description: "Idea deleted successfully." });
        setIdeas(prev => prev.filter(idea => idea.id !== ideaId));
      }
    } catch (error) {
      console.error('Error deleting idea:', error);
      toast({ title: "Error", description: "Failed to delete idea. Please try again." });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{boardName}</h1>
        </div>
        <div className="text-center py-8">Loading board...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{boardName}</h1>
        <Button onClick={() => {
          const itemTypeCapitalized = boardItemType.charAt(0).toUpperCase() + boardItemType.slice(1);
          const title = prompt(`${itemTypeCapitalized} title`);
          if (!title) return;
          const description = prompt("Optional description");
          addIdea(title, description ?? undefined);
        }}>New {boardItemType.charAt(0).toUpperCase() + boardItemType.slice(1)}</Button>
      </div>
      <FiltersBar value={filters} onChange={setFilters} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Column title="Backlog" status="backlog" ideas={grouped.backlog} onMove={move} onVote={vote} onOpen={setActiveIdea} onDelete={deleteIdea} boardSlug={boardSlug} onUpdateIdea={(updatedIdea) => setIdeas(prev => prev.map(idea => idea.id === updatedIdea.id ? updatedIdea : idea))} />
        <Column title="In discussion" status="discussion" ideas={grouped.discussion} onMove={move} onVote={vote} onOpen={setActiveIdea} onDelete={deleteIdea} boardSlug={boardSlug} onUpdateIdea={(updatedIdea) => setIdeas(prev => prev.map(idea => idea.id === updatedIdea.id ? updatedIdea : idea))} />
        <Column title="In production" status="production" ideas={grouped.production} onMove={move} onVote={vote} onOpen={setActiveIdea} onDelete={deleteIdea} boardSlug={boardSlug} onUpdateIdea={(updatedIdea) => setIdeas(prev => prev.map(idea => idea.id === updatedIdea.id ? updatedIdea : idea))} />
        <Column title="In review" status="review" ideas={grouped.review} onMove={move} onVote={vote} onOpen={setActiveIdea} onDelete={deleteIdea} boardSlug={boardSlug} onUpdateIdea={(updatedIdea) => setIdeas(prev => prev.map(idea => idea.id === updatedIdea.id ? updatedIdea : idea))} />
        <Column title="Roadblock" status="roadblock" ideas={grouped.roadblock} onMove={move} onVote={vote} onOpen={setActiveIdea} onDelete={deleteIdea} boardSlug={boardSlug} onUpdateIdea={(updatedIdea) => setIdeas(prev => prev.map(idea => idea.id === updatedIdea.id ? updatedIdea : idea))} />
        <Column title="Done" status="done" ideas={grouped.done} onMove={move} onVote={vote} onOpen={setActiveIdea} onDelete={deleteIdea} boardSlug={boardSlug} onUpdateIdea={(updatedIdea) => setIdeas(prev => prev.map(idea => idea.id === updatedIdea.id ? updatedIdea : idea))} />
      </div>
      {activeIdea && <IdeaModal 
        idea={activeIdea} 
        isOpen={!!activeIdea} 
        onClose={() => setActiveIdea(null)} 
        onUpdate={(updatedIdea) => {
          setIdeas(prev => prev.map(idea => idea.id === updatedIdea.id ? updatedIdea : idea));
        }}
        boardSlug={boardSlug}
      />}
    </div>
  );
}
