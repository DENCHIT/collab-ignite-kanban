import { useEffect, useMemo, useState } from "react";
import { Column } from "./Column";
import { FiltersBar, FiltersState } from "./FiltersBar";
import { Idea, IdeaStatus, Thresholds } from "@/types/idea";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { IdeaModal } from "./IdeaModal";
import { getDisplayName, getUserToken, isAdmin, loadIdeas, loadThresholds, saveIdeas } from "@/lib/session";

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
  },
];

export function Board() {
  const [thresholds] = useState<Thresholds>(loadThresholds(defaultThresholds));
  const [ideas, setIdeas] = useState<Idea[]>(loadIdeas<Idea[]>(initialIdeas));
  const [filters, setFilters] = useState<FiltersState>({ q: "", highScore: false, recent: true, mine: false, blocked: false });
  const [activeIdea, setActiveIdea] = useState<Idea | null>(null);

  useEffect(() => {
    saveIdeas(ideas);
  }, [ideas]);

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
        if (filters.highScore) return b.score - a.score;
        if (filters.recent) return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
        return 0;
      })
      .forEach((it) => buckets[it.status].push(it));

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

  function vote(id: string, delta: 1 | -1) {
    const token = getUserToken();
    const me = getDisplayName() ?? "Anonymous";
    setIdeas((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        if (it.voters[token]) {
          toast({ title: "Already voted", description: "You cannot vote twice on the same idea." });
          return it;
        }
        let updated: Idea = {
          ...it,
          voters: { ...it.voters, [token]: delta },
          score: it.score + delta,
          lastActivityAt: new Date().toISOString(),
        };
        updated = logHistory(updated, { type: "voted", user: me, timestamp: updated.lastActivityAt, delta, details: delta > 0 ? "+1" : "-1" });
        updated = autoMove(updated);
        return updated;
      })
    );
  }

  function move(id: string, to: IdeaStatus, reason?: string) {
    setIdeas((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const from = it.status;
        if (to === "done" && !isAdmin()) {
          toast({ title: "Only admins can move to Done" });
          return it;
        }
        let updated: Idea = { ...it, status: to, lastActivityAt: new Date().toISOString() };
        if (to === "roadblock") updated.blockedReason = reason || "";
        if (from === "roadblock" && to !== "roadblock") updated.blockedReason = undefined;
        updated = logHistory(updated, { type: "moved", user: getDisplayName() ?? "Anonymous", timestamp: updated.lastActivityAt, from, to, details: reason });
        return updated;
      })
    );
  }

  function addIdea(title: string, description?: string) {
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
    };
    setIdeas((prev) => [newIdea, ...prev]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Team Ideas Board</h1>
        <Button onClick={() => {
          const title = prompt("Idea title");
          if (!title) return;
          const description = prompt("Optional description");
          addIdea(title, description ?? undefined);
        }}>New Idea</Button>
      </div>
      <FiltersBar value={filters} onChange={setFilters} />
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Column title="Backlog" status="backlog" ideas={grouped.backlog} onMove={move} onVote={vote} onOpen={setActiveIdea} />
        <Column title="In discussion" status="discussion" ideas={grouped.discussion} onMove={move} onVote={vote} onOpen={setActiveIdea} />
        <Column title="In production" status="production" ideas={grouped.production} onMove={move} onVote={vote} onOpen={setActiveIdea} />
        <Column title="In review" status="review" ideas={grouped.review} onMove={move} onVote={vote} onOpen={setActiveIdea} />
        <Column title="Roadblock" status="roadblock" ideas={grouped.roadblock} onMove={move} onVote={vote} onOpen={setActiveIdea} />
        <Column title="Done" status="done" ideas={grouped.done} onMove={move} onVote={vote} onOpen={setActiveIdea} />
      </div>
      <IdeaModal idea={activeIdea} onClose={() => setActiveIdea(null)} />
    </div>
  );
}
