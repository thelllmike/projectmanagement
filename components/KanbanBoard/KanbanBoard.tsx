"use client";

import { useState, useEffect, useCallback } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { KanbanColumn, KanbanCard, Label, User, Priority } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import Column from "./Column";
import styles from "./styles.module.css";

interface KanbanBoardProps {
  teamId: string;
}

export default function KanbanBoard({ teamId }: KanbanBoardProps) {
  const { getTeamMembers } = useAuth();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  // Fetch kanban data
  const fetchData = useCallback(async () => {
    setIsLoading(true);

    // Fetch columns
    const { data: columnsData } = await supabase
      .from("kanban_columns")
      .select("*")
      .eq("team_id", teamId)
      .order("position");

    // Fetch labels
    const { data: labelsData } = await supabase
      .from("labels")
      .select("*")
      .eq("team_id", teamId);

    if (columnsData) {
      // Fetch cards for each column
      const columnsWithCards = await Promise.all(
        columnsData.map(async (column) => {
          const { data: cards } = await supabase
            .from("kanban_cards")
            .select(`
              *,
              card_labels(label_id)
            `)
            .eq("column_id", column.id)
            .order("position");

          return {
            ...column,
            cards: (cards || []).map((card) => ({
              ...card,
              labels: card.card_labels?.map((cl: { label_id: string }) => cl.label_id) || [],
            })),
          };
        })
      );
      setColumns(columnsWithCards);
    }

    if (labelsData) {
      setLabels(labelsData);
    }

    // Fetch team members
    const members = await getTeamMembers(teamId);
    setTeamMembers(members);

    setIsLoading(false);
  }, [teamId, supabase, getTeamMembers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // Optimistic update
    const newColumns = columns.map((col) => ({
      ...col,
      cards: [...(col.cards || [])],
    }));

    const sourceColumn = newColumns.find((col) => col.id === source.droppableId);
    const destColumn = newColumns.find((col) => col.id === destination.droppableId);

    if (!sourceColumn || !destColumn) return;

    const [movedCard] = sourceColumn.cards.splice(source.index, 1);

    if (sourceColumn.id === destColumn.id) {
      sourceColumn.cards.splice(destination.index, 0, movedCard);
    } else {
      destColumn.cards.splice(destination.index, 0, movedCard);
    }

    setColumns(newColumns);

    // Update in database
    try {
      // Update card position and column
      await supabase
        .from("kanban_cards")
        .update({
          column_id: destination.droppableId,
          position: destination.index,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draggableId);

      // Update positions of other cards in destination column
      const cardsToUpdate = destColumn.cards
        .filter((card) => card.id !== draggableId)
        .map((card, index) => ({
          id: card.id,
          position: index >= destination.index ? index + 1 : index,
        }));

      for (const card of cardsToUpdate) {
        await supabase
          .from("kanban_cards")
          .update({ position: card.position })
          .eq("id", card.id);
      }
    } catch (error) {
      console.error("Error moving card:", error);
      fetchData(); // Refetch on error
    }
  };

  const handleAddCard = async (columnId: string, title: string) => {
    const column = columns.find((c) => c.id === columnId);
    const nextPosition = column ? (column.cards || []).length : 0;

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

    if (error) {
      console.error("Error adding card:", error);
      return;
    }

    // Update local state
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId
          ? { ...col, cards: [...(col.cards || []), { ...card, labels: [] }] }
          : col
      )
    );
  };

  const handleUpdateCard = async (
    columnId: string,
    cardId: string,
    updates: Partial<Omit<KanbanCard, "id">>
  ) => {
    // Handle labels separately
    if (updates.labels !== undefined) {
      const column = columns.find((c) => c.id === columnId);
      const card = (column?.cards || []).find((c) => c.id === cardId);
      const currentLabels = card?.labels || [];
      const newLabels = updates.labels;

      // Find labels to add and remove
      const labelsToAdd = newLabels.filter((l) => !currentLabels.includes(l));
      const labelsToRemove = currentLabels.filter((l) => !newLabels.includes(l));

      // Add new labels
      for (const labelId of labelsToAdd) {
        await supabase
          .from("card_labels")
          .insert({ card_id: cardId, label_id: labelId });
      }

      // Remove labels
      for (const labelId of labelsToRemove) {
        await supabase
          .from("card_labels")
          .delete()
          .eq("card_id", cardId)
          .eq("label_id", labelId);
      }
    }

    // Update other fields (exclude labels as they're handled above)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { labels: _labelsHandledAbove, ...otherUpdates } = updates;
    if (Object.keys(otherUpdates).length > 0) {
      // Map frontend field names to database field names
      const dbUpdates: Record<string, unknown> = {};
      if (otherUpdates.title !== undefined) dbUpdates.title = otherUpdates.title;
      if (otherUpdates.priority !== undefined) dbUpdates.priority = otherUpdates.priority;
      if (otherUpdates.assignee_id !== undefined) dbUpdates.assignee_id = otherUpdates.assignee_id;
      dbUpdates.updated_at = new Date().toISOString();

      await supabase
        .from("kanban_cards")
        .update(dbUpdates)
        .eq("id", cardId);
    }

    // Update local state
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId
          ? {
              ...col,
              cards: (col.cards || []).map((card) =>
                card.id === cardId ? { ...card, ...updates } : card
              ),
            }
          : col
      )
    );
  };

  const handleDeleteCard = async (columnId: string, cardId: string) => {
    const { error } = await supabase
      .from("kanban_cards")
      .delete()
      .eq("id", cardId);

    if (error) {
      console.error("Error deleting card:", error);
      return;
    }

    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId
          ? { ...col, cards: (col.cards || []).filter((card) => card.id !== cardId) }
          : col
      )
    );
  };

  if (isLoading) {
    return <div className={styles.board}>Loading...</div>;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className={styles.board}>
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            labels={labels}
            teamMembers={teamMembers}
            onAddCard={handleAddCard}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
