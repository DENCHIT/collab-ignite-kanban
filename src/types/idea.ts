export type IdeaStatus =
  | "backlog"
  | "discussion"
  | "production"
  | "review"
  | "roadblock"
  | "done";

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
}

export interface Thresholds {
  toDiscussion: number; // Backlog -> Discussion
  toProduction: number; // Discussion -> Production
  toBacklog: number; // Any -> Backlog if <= -X
}
