"use client";

import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { KanbanData, KanbanCard, DEFAULT_LABELS, DEFAULT_COLUMNS } from "@/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAuth } from "@/contexts/AuthContext";
import Column from "./Column";
import styles from "./styles.module.css";

interface KanbanBoardProps {
  teamId: string;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export default function KanbanBoard({ teamId }: KanbanBoardProps) {
  const { getTeamMembers } = useAuth();
  const initialData: KanbanData = {
    columns: DEFAULT_COLUMNS,
    labels: DEFAULT_LABELS,
  };

  const [data, setData] = useLocalStorage<KanbanData>(
    `vibe-pm-kanban-${teamId}`,
    initialData
  );

  const teamMembers = getTeamMembers(teamId);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    setData((prev) => {
      const newColumns = prev.columns.map((col) => ({
        ...col,
        cards: [...col.cards],
      }));

      const sourceColumn = newColumns.find((col) => col.id === source.droppableId);
      const destColumn = newColumns.find((col) => col.id === destination.droppableId);

      if (!sourceColumn || !destColumn) return prev;

      const [movedCard] = sourceColumn.cards.splice(source.index, 1);

      if (sourceColumn.id === destColumn.id) {
        sourceColumn.cards.splice(destination.index, 0, movedCard);
      } else {
        destColumn.cards.splice(destination.index, 0, movedCard);
      }

      return { ...prev, columns: newColumns };
    });
  };

  const handleAddCard = (columnId: string, title: string) => {
    setData((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.id === columnId
          ? {
              ...col,
              cards: [
                ...col.cards,
                { id: generateId(), title, priority: "none", labels: [] },
              ],
            }
          : col
      ),
    }));
  };

  const handleUpdateCard = (
    columnId: string,
    cardId: string,
    updates: Partial<Omit<KanbanCard, "id">>
  ) => {
    setData((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.id === columnId
          ? {
              ...col,
              cards: col.cards.map((card) =>
                card.id === cardId ? { ...card, ...updates } : card
              ),
            }
          : col
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setData((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.id === columnId
          ? { ...col, cards: col.cards.filter((card) => card.id !== cardId) }
          : col
      ),
    }));
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className={styles.board}>
        {data.columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            labels={data.labels || DEFAULT_LABELS}
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
