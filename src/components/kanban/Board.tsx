import { useEffect, useMemo, useState } from "react";
import { Column } from "./Column";
import { AddColumn } from "./AddColumn";
import { FiltersBar, FiltersState } from "./FiltersBar";
import { Idea, IdeaStatus, CoreIdeaStatus, Thresholds } from "@/types/idea";
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
    assignees: [],
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
    assignees: [],
  },
];

export function Board({ boardSlug }: { boardSlug?: string }) {
  const [thresholds] = useState<Thresholds>(loadThresholds(defaultThresholds, boardSlug));
  const [boardName, setBoardName] = useState<string>("Team Ideas Board");
  const [boardItemType, setBoardItemType] = useState<string>("idea");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [filters, setFilters] = useState<FiltersState>({ q: "", highScore: false, recent: true, mine: false, blocked: false, assignedToMe: false });
  const [activeIdea, setActiveIdea] = useState<Idea | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [columnNames, setColumnNames] = useState<Record<string, string>>({
    backlog: "Backlog",
    discussion: "In discussion", 
    production: "In production",
    review: "In review",
    roadblock: "Roadblock",
    done: "Done"
  });
  
  // Define the order of core columns
  const coreColumnOrder: CoreIdeaStatus[] = ["backlog", "discussion", "production", "review", "roadblock", "done"];
  
  // Get all column keys in proper order (core columns first, then custom columns)
  const allColumns = useMemo(() => {
    const customColumns = Object.keys(columnNames).filter(key => !coreColumnOrder.includes(key as CoreIdeaStatus));
    return [...coreColumnOrder, ...customColumns];
  }, [columnNames]);

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

  // Helper function to get current user email
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
          .select('id, name, item_type, column_names')
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
        
        // Set column names if they exist
        if (board.column_names) {
          setColumnNames(board.column_names as Record<IdeaStatus, string>);
        }

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
          checklist: dbIdea.checklist as any[] || [],
          assignees: dbIdea.assignees as string[] || []
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
              checklist: payload.new.checklist as any[] || [],
              assignees: payload.new.assignees as string[] || []
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
              checklist: payload.new.checklist as any[] || [],
              assignees: payload.new.assignees as string[] || []
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

  // Subscribe to board metadata updates (name, column_names, item_type)
  useEffect(() => {
    if (!boardId) return;

    const channel = supabase
      .channel(`board-changes-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'boards',
          filter: `id=eq.${boardId}`
        },
        (payload) => {
          console.log('Board update:', payload);
          const newCols = (payload.new?.column_names || null) as Record<IdeaStatus, string> | null;
          if (newCols) setColumnNames(newCols);
          const newName = payload.new?.name as string | undefined;
          if (newName) setBoardName(newName);
          const newType = payload.new?.item_type as string | undefined;
          if (newType) setBoardItemType(newType);
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

    console.log('Filtering debug:', {
      userEmail,
      assignedToMeFilter: filters.assignedToMe,
      sampleAssignees: ideas.slice(0, 2).map(i => ({ id: i.id, assignees: i.assignees }))
    });

    ideas
      .filter((it) => (filters.blocked ? it.status === "roadblock" : true))
      .filter((it) => (filters.mine && me ? it.creatorName === me : true))
      .filter((it) => {
        if (!filters.assignedToMe) return true;
        if (!userEmail) return false;
        const isAssigned = it.assignees.includes(userEmail);
        console.log(`Idea "${it.title}": assignees=[${it.assignees.join(', ')}], userEmail="${userEmail}", isAssigned=${isAssigned}`);
        return isAssigned;
      })
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

    // Optimistically update UI
    setIdeas(prev => prev.map(idea => idea.id === id ? updated : idea));

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
      // Revert on error
      setIdeas(prev => prev.map(idea => idea.id === id ? (ideaToUpdate as Idea) : idea));
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
    
    // Optimistically update UI
    setIdeas(prev => prev.map(idea => idea.id === id ? updated : idea));
    
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
      // Revert on error
      setIdeas(prev => prev.map(idea => idea.id === id ? (ideaToUpdate as Idea) : idea));
    } else {
      // Send email notification for idea move to board managers
      try {
        const currentUserEmail = getCurrentUserEmail();
        await supabase.functions.invoke('email-notifications', {
          body: {
            event_type: 'moved',
            board_id: boardId,
            idea_id: id,
            actor_email: currentUserEmail || 'system',
            payload: {
              from: ideaToUpdate.status,
              to: to,
              reason: reason
            }
          }
        });
      } catch (emailError) {
        console.error('Failed to send move email notifications:', emailError);
      }
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
      assignees: [],
    };
    
    // Optimistically add to UI
    setIdeas(prev => [newIdea, ...prev]);
    
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
        assignees: newIdea.assignees,
      });

    if (error) {
      console.error('Error adding idea:', error);
      toast({ title: "Error", description: "Failed to add idea. Please try again." });
      // Revert on error
      setIdeas(prev => prev.filter(i => i.id !== newIdea.id));
    } else {
      // Send email notification for new idea to board managers
      try {
        const creatorEmail = getCurrentUserEmail();
        await supabase.functions.invoke('email-notifications', {
          body: {
            event_type: 'new_item',
            board_id: boardId,
            idea_id: newIdea.id,
            actor_email: creatorEmail || 'system'
          }
        });
      } catch (emailError) {
        console.error('Failed to send new idea email notifications:', emailError);
      }
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

  const updateColumnName = async (status: IdeaStatus, newName: string) => {
    if (!boardId) return;

    try {
      const updatedColumnNames = { ...columnNames, [status]: newName };
      
      const { error } = await supabase
        .from('boards')
        .update({ column_names: updatedColumnNames })
        .eq('id', boardId);

      if (error) {
        console.error('Error updating column name:', error);
        toast({ title: "Error", description: "Failed to update column name." });
      } else {
        setColumnNames(updatedColumnNames);
        toast({ title: "Success", description: "Column name updated successfully." });
      }
    } catch (error) {
      console.error('Error updating column name:', error);
      toast({ title: "Error", description: "Failed to update column name." });
    }
  };

  const addColumn = async (columnName: string) => {
    if (!boardId || !columnName.trim()) return;

    try {
      // Generate a unique key for the new column
      const columnKey = `custom_${Date.now()}`;
      const updatedColumnNames = {
        ...columnNames,
        [columnKey]: columnName.trim()
      };

      const { error } = await supabase
        .from('boards')
        .update({ column_names: updatedColumnNames })
        .eq('id', boardId);

      if (error) {
        console.error('Error adding column:', error);
        toast({ title: "Error", description: "Failed to add column." });
      } else {
        setColumnNames(updatedColumnNames);
        toast({ title: "Success", description: "Column added successfully." });
      }
    } catch (error) {
      console.error('Error adding column:', error);
      toast({ title: "Error", description: "Failed to add column." });
    }
  };

  const moveColumn = async (columnKey: string, direction: 'left' | 'right') => {
    if (!boardId) return;

    try {
      const currentIndex = allColumns.indexOf(columnKey);
      if (currentIndex === -1) return;

      const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= allColumns.length) return;

      // Create new column order
      const newColumns = [...allColumns];
      [newColumns[currentIndex], newColumns[newIndex]] = [newColumns[newIndex], newColumns[currentIndex]];

      // Build the complete columnNames object with proper ordering
      // We'll store the order by using numbered keys to preserve sequence
      const reorderedColumnNames: Record<string, string> = {};
      
      // Add all columns in the new order with sequence preservation
      newColumns.forEach((key, index) => {
        reorderedColumnNames[key] = columnNames[key];
      });

      // Also store the column order separately
      const columnOrder = newColumns;

      const { error } = await supabase
        .from('boards')
        .update({ 
          column_names: reorderedColumnNames,
          column_order: columnOrder 
        })
        .eq('id', boardId);

      if (error) {
        console.error('Error reordering columns:', error);
        toast({ title: "Error", description: "Failed to reorder columns." });
      } else {
        setColumnNames(reorderedColumnNames);
        // Force refresh to get the new order
        window.location.reload();
        toast({ title: "Success", description: "Column reordered successfully." });
      }
    } catch (error) {
      console.error('Error reordering columns:', error);
      toast({ title: "Error", description: "Failed to reorder columns." });
    }
  };

  const deleteColumn = async (columnKey: string) => {
    if (!boardId || coreColumnOrder.includes(columnKey as CoreIdeaStatus)) {
      toast({ title: "Error", description: "Cannot delete core columns." });
      return;
    }

    try {
      // Check if any ideas are in this column
      const ideasInColumn = ideas.filter(idea => idea.status === columnKey);
      if (ideasInColumn.length > 0) {
        const shouldDelete = confirm(`This column contains ${ideasInColumn.length} items. They will be moved to Backlog. Continue?`);
        if (!shouldDelete) return;

        // Move all ideas to backlog
        for (const idea of ideasInColumn) {
          await supabase
            .from('ideas')
            .update({ 
              status: 'backlog',
              last_activity_at: new Date().toISOString()
            })
            .eq('id', idea.id);
        }
      }

      // Remove column from column names
      const updatedColumnNames = { ...columnNames };
      delete updatedColumnNames[columnKey];

      const { error } = await supabase
        .from('boards')
        .update({ column_names: updatedColumnNames })
        .eq('id', boardId);

      if (error) {
        console.error('Error deleting column:', error);
        toast({ title: "Error", description: "Failed to delete column." });
      } else {
        setColumnNames(updatedColumnNames);
        // Update local ideas state to reflect moved ideas
        setIdeas(prev => prev.map(idea => 
          idea.status === columnKey ? { ...idea, status: 'backlog' } : idea
        ));
        toast({ title: "Success", description: "Column deleted successfully." });
      }
    } catch (error) {
      console.error('Error deleting column:', error);
      toast({ title: "Error", description: "Failed to delete column." });
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
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)]">
        {allColumns.map((columnKey, index) => (
          <div key={columnKey} className="flex-none w-80 h-full">
            <Column 
              title={columnNames[columnKey]} 
              status={columnKey} 
              ideas={grouped[columnKey] || []} 
              onMove={move} 
              onVote={vote} 
              onOpen={setActiveIdea} 
              onDelete={deleteIdea} 
              boardSlug={boardSlug} 
              onUpdateIdea={(updatedIdea) => setIdeas(prev => prev.map(idea => idea.id === updatedIdea.id ? updatedIdea : idea))} 
              onUpdateColumnName={updateColumnName} 
              onDeleteColumn={!coreColumnOrder.includes(columnKey as CoreIdeaStatus) ? deleteColumn : undefined}
              onMoveColumn={moveColumn}
              columnNames={columnNames} 
              isCustomColumn={!coreColumnOrder.includes(columnKey as CoreIdeaStatus)}
              canMoveLeft={index > 0}
              canMoveRight={index < allColumns.length - 1}
              hasIdeas={(grouped[columnKey] || []).length > 0}
            />
          </div>
        ))}
        <AddColumn onAddColumn={addColumn} />
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
