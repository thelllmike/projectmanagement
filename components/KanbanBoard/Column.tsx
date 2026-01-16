"use client";

import { useState, useRef, useEffect } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { KanbanColumn, KanbanCard, Label, User } from "@/types";
import Card from "./Card";
import styles from "./styles.module.css";

interface ColumnProps {
  column: KanbanColumn;
  labels: Label[];
  teamMembers: User[];
  onAddCard: (columnId: string, title: string) => void;
  onUpdateCard: (columnId: string, cardId: string, updates: Partial<Omit<KanbanCard, "id">>) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
}

export default function Column({ column, labels, teamMembers, onAddCard, onUpdateCard, onDeleteCard }: ColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleAddCard = () => {
    if (newCardTitle.trim()) {
      onAddCard(column.id, newCardTitle.trim());
      setNewCardTitle("");
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddCard();
    } else if (e.key === "Escape") {
      setNewCardTitle("");
      setIsAdding(false);
    }
  };

  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <span className={styles.columnTitle}>{column.title}</span>
        <span className={styles.cardCount}>{column.cards.length}</span>
      </div>
      <Droppable droppableId={column.id}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={styles.cardList}
          >
            {column.cards.map((card, index) => (
              <Card
                key={card.id}
                card={card}
                index={index}
                labels={labels}
                teamMembers={teamMembers}
                onUpdate={(cardId, updates) => onUpdateCard(column.id, cardId, updates)}
                onDelete={(cardId) => onDeleteCard(column.id, cardId)}
              />
            ))}
            {provided.placeholder}
            {isAdding && (
              <div className={styles.newCardInput}>
                <input
                  ref={inputRef}
                  type="text"
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter card title..."
                  className={styles.newCardInputField}
                />
                <div className={styles.newCardActions}>
                  <button onClick={handleAddCard} className={styles.saveButton}>
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setNewCardTitle("");
                      setIsAdding(false);
                    }}
                    className={styles.cancelButton}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Droppable>
      {!isAdding && (
        <button onClick={() => setIsAdding(true)} className={styles.addCardButton}>
          Add card
        </button>
      )}
    </div>
  );
}
