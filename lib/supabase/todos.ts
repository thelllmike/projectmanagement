import { createClient } from "./client";
import { TodoItem } from "@/types";

const supabase = createClient();

// Fetch all todos for a team
export async function getTodos(teamId: string): Promise<TodoItem[]> {
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

// Add a new todo
export async function addTodo(teamId: string, text: string): Promise<TodoItem> {
  const { data: todo, error } = await supabase
    .from("todos")
    .insert({
      team_id: teamId,
      text,
      completed: false,
    })
    .select()
    .single();

  if (error) throw error;
  return todo;
}

// Toggle todo completion
export async function toggleTodo(todoId: string, completed: boolean): Promise<TodoItem> {
  const { data: todo, error } = await supabase
    .from("todos")
    .update({ completed, updated_at: new Date().toISOString() })
    .eq("id", todoId)
    .select()
    .single();

  if (error) throw error;
  return todo;
}

// Delete a todo
export async function deleteTodo(todoId: string): Promise<void> {
  const { error } = await supabase
    .from("todos")
    .delete()
    .eq("id", todoId);

  if (error) throw error;
}
