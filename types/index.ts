export type Priority = "high" | "medium" | "low" | "none";

// Database types (from Supabase)
export interface Profile {
  id: string;
  name: string;
  avatar_color: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
  // Joined data
  profile?: Profile;
}

export interface Label {
  id: string;
  team_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface KanbanColumn {
  id: string;
  team_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
  // Joined data
  cards?: KanbanCard[];
}

export interface KanbanCard {
  id: string;
  column_id: string;
  title: string;
  description?: string;
  priority: Priority;
  assignee_id?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  // Joined data - labels is array of label IDs
  labels?: string[];
  assignee?: Profile;
}

export interface CardLabel {
  card_id: string;
  label_id: string;
}

export interface TodoItem {
  id: string;
  team_id: string;
  text: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  team_id: string;
  content: string;
  updated_at: string;
}

// Frontend types (transformed from DB)
export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface KanbanData {
  columns: KanbanColumn[];
  labels: Label[];
}

// Auth types
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

// Avatar colors for users
export const AVATAR_COLORS = [
  "#e57373", "#f06292", "#ba68c8", "#9575cd",
  "#7986cb", "#64b5f6", "#4fc3f7", "#4dd0e1",
  "#4db6ac", "#81c784", "#aed581", "#dce775",
  "#fff176", "#ffd54f", "#ffb74d", "#ff8a65",
];
