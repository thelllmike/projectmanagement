export type Priority = "high" | "medium" | "low" | "none";

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string; // Color or initials for avatar
  teamIds: string[];
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
}

export interface KanbanCard {
  id: string;
  title: string;
  priority: Priority;
  labels: string[];
  assigneeId?: string; // User ID
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanData {
  columns: KanbanColumn[];
  labels: Label[];
}

export interface TeamWorkspace {
  teamId: string;
  kanban: KanbanData;
  todos: TodoItem[];
  notes: string;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

// Auth types
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

// Default labels
export const DEFAULT_LABELS: Label[] = [
  { id: "bug", name: "Bug", color: "#e57373" },
  { id: "feature", name: "Feature", color: "#81c784" },
  { id: "design", name: "Design", color: "#ba68c8" },
  { id: "docs", name: "Docs", color: "#64b5f6" },
  { id: "refactor", name: "Refactor", color: "#ffb74d" },
];

// Default columns
export const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "todo", title: "Todo", cards: [] },
  { id: "in-progress", title: "In Progress", cards: [] },
  { id: "review", title: "Review", cards: [] },
  { id: "complete", title: "Complete", cards: [] },
];

// Avatar colors for users
export const AVATAR_COLORS = [
  "#e57373", "#f06292", "#ba68c8", "#9575cd",
  "#7986cb", "#64b5f6", "#4fc3f7", "#4dd0e1",
  "#4db6ac", "#81c784", "#aed581", "#dce775",
  "#fff176", "#ffd54f", "#ffb74d", "#ff8a65",
];
