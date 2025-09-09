// Core status types - these are the default columns
export type CoreIdeaStatus = 
  | "backlog"
  | "discussion"
  | "production"
  | "review"
  | "roadblock"
  | "done";

// IdeaStatus can now be any string to support custom columns
export type IdeaStatus = string;

export interface IdeaChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface IdeaHistoryItem {
  id: string;
  type:
    | "created"
    | "voted"
    | "moved"
    | "blocked"
    | "unblocked"
    | "commented";
  user: string;
  timestamp: string; // ISO
  details?: string;
  from?: IdeaStatus;
  to?: IdeaStatus;
  delta?: number; // vote change
}

export interface IdeaComment {
  id: string;
  user: string;
  text: string;
  content?: string; // Rich text content (HTML)
  attachments?: IdeaCommentAttachment[];
  timestamp: string;
  replyTo?: string; // ID of comment being replied to
  reactions?: Record<string, string[]>; // emoji -> array of user emails
}

export interface IdeaCommentAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface Idea {
  id: string;
  title: string;
  description?: string;
  creatorName: string;
  score: number;
  status: IdeaStatus;
  lastActivityAt: string; // ISO
  voters: Record<string, number>; // token => +1 | -1
  comments: IdeaComment[];
  history: IdeaHistoryItem[];
  blockedReason?: string;
  watchers: string[]; // Array of user emails watching this idea
  checklist: IdeaChecklistItem[]; // Array of checklist items
  assignees: string[]; // Array of user emails assigned to this idea
}

export interface Thresholds {
  toDiscussion: number; // Backlog -> Discussion
  toProduction: number; // Discussion -> Production
  toBacklog: number; // Any -> Backlog if <= -X
}
