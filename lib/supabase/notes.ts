import { createClient } from "./client";

const supabase = createClient();

// Get notes for a team
export async function getNotes(teamId: string): Promise<string> {
  const { data, error } = await supabase
    .from("notes")
    .select("content")
    .eq("team_id", teamId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows found
  return data?.content || "";
}

// Update notes for a team
export async function updateNotes(teamId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from("notes")
    .upsert(
      { team_id: teamId, content, updated_at: new Date().toISOString() },
      { onConflict: "team_id" }
    );

  if (error) throw error;
}
