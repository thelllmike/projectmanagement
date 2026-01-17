import { createClient } from "./client";
import { Priority } from "@/types";

const supabase = createClient();

interface DbColumn {
  id: string;
  team_id: string;
  title: string;
  position: number;
}

interface DbCard {
  id: string;
  column_id: string;
  title: string;
  priority: Priority;
  assignee_id?: string | null;
  position: number;
  card_labels?: { label_id: string }[];
}

// Fetch all columns with cards for a team
export async function getKanbanData(teamId: string) {
  const [columnsResult, labelsResult] = await Promise.all([
    supabase
      .from("kanban_columns")
      .select("*")
      .eq("team_id", teamId)
      .order("position"),
    supabase
      .from("labels")
      .select("*")
      .eq("team_id", teamId),
  ]);

  const columns = columnsResult.data || [];
  const labels = labelsResult.data || [];

  // Fetch cards for each column
  const columnsWithCards = await Promise.all(
    columns.map(async (column: DbColumn) => {
      const { data: cards } = await supabase
        .from("kanban_cards")
        .select(`
          *,
          card_labels(label_id),
          assignee:profiles(id, name, avatar_color)
        `)
        .eq("column_id", column.id)
        .order("position");

      return {
        ...column,
        cards: (cards || []).map((card: DbCard) => ({
          ...card,
          labels: card.card_labels?.map((cl) => cl.label_id) || [],
        })),
      };
    })
  );

  return { columns: columnsWithCards, labels };
}

// Add a new card
export async function addCard(columnId: string, title: string) {
  // Get the highest position in the column
  const { data: existingCards } = await supabase
    .from("kanban_cards")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = existingCards && existingCards.length > 0 ? existingCards[0].position + 1 : 0;

  const { data: card, error } = await supabase
    .from("kanban_cards")
    .insert({
      column_id: columnId,
      title,
      priority: "none" as Priority,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) throw error;
  return { ...card, labels: [] };
}

// Update a card
export async function updateCard(
  cardId: string,
  updates: Partial<{ title: string; priority: Priority; assignee_id: string | null; description: string }>
) {
  const { data: card, error } = await supabase
    .from("kanban_cards")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", cardId)
    .select()
    .single();

  if (error) throw error;
  return card;
}

// Delete a card
export async function deleteCard(cardId: string) {
  const { error } = await supabase
    .from("kanban_cards")
    .delete()
    .eq("id", cardId);

  if (error) throw error;
}

// Move a card (reorder or change column)
export async function moveCard(
  cardId: string,
  sourceColumnId: string,
  destColumnId: string,
  newPosition: number
) {
  // If moving to a different column
  if (sourceColumnId !== destColumnId) {
    // Update positions in destination column
    await supabase.rpc("shift_card_positions", {
      p_column_id: destColumnId,
      p_start_position: newPosition,
      p_direction: 1,
    });
  }

  // Update the card's column and position
  const { error } = await supabase
    .from("kanban_cards")
    .update({
      column_id: destColumnId,
      position: newPosition,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId);

  if (error) throw error;
}

// Toggle a label on a card
export async function toggleCardLabel(cardId: string, labelId: string, hasLabel: boolean) {
  if (hasLabel) {
    // Remove label
    const { error } = await supabase
      .from("card_labels")
      .delete()
      .eq("card_id", cardId)
      .eq("label_id", labelId);

    if (error) throw error;
  } else {
    // Add label
    const { error } = await supabase
      .from("card_labels")
      .insert({ card_id: cardId, label_id: labelId });

    if (error) throw error;
  }
}

// Get labels for a card
export async function getCardLabels(cardId: string): Promise<string[]> {
  const { data } = await supabase
    .from("card_labels")
    .select("label_id")
    .eq("card_id", cardId);

  return data?.map((cl: { label_id: string }) => cl.label_id) || [];
}
