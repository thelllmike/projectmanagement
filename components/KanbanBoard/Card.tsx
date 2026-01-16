"use client";

import { useState, useRef, useEffect } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { KanbanCard, Priority, Label, User } from "@/types";
import styles from "./styles.module.css";

interface CardProps {
  card: KanbanCard;
  index: number;
  labels: Label[];
  teamMembers: User[];
  onUpdate: (id: string, updates: Partial<Omit<KanbanCard, "id">>) => void;
  onDelete: (id: string) => void;
}

const priorityClasses: Record<Priority, string> = {
  high: styles.priorityHigh,
  medium: styles.priorityMedium,
  low: styles.priorityLow,
  none: "",
};

export default function Card({ card, index, labels, teamMembers, onUpdate, onDelete }: CardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [title, setTitle] = useState(card.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const handleSave = () => {
    if (title.trim()) {
      onUpdate(card.id, { title: title.trim() });
    } else {
      setTitle(card.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setTitle(card.title);
      setIsEditing(false);
    }
  };

  const handlePriorityChange = (priority: Priority) => {
    onUpdate(card.id, { priority });
  };

  const handleLabelToggle = (labelId: string) => {
    const newLabels = card.labels.includes(labelId)
      ? card.labels.filter((l) => l !== labelId)
      : [...card.labels, labelId];
    onUpdate(card.id, { labels: newLabels });
  };

  const handleAssigneeChange = (userId: string | undefined) => {
    onUpdate(card.id, { assigneeId: userId });
  };

  const cardLabels = labels.filter((l) => card.labels.includes(l.id));
  const assignee = teamMembers.find((m) => m.id === card.assigneeId);

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`${styles.card} ${snapshot.isDragging ? styles.cardDragging : ""} ${priorityClasses[card.priority]}`}
        >
          {/* Labels */}
          {cardLabels.length > 0 && (
            <div className={styles.cardLabels}>
              {cardLabels.map((label) => (
                <span
                  key={label.id}
                  className={styles.cardLabel}
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}

          <div className={styles.cardContent}>
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={styles.cardInput}
              />
            ) : (
              <span className={styles.cardTitle}>{card.title}</span>
            )}
            <div className={styles.cardActions}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className={styles.cardButton}
                title="Options"
              >
                ...
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className={styles.cardButton}
                title="Edit"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(card.id)}
                className={`${styles.cardButton} ${styles.deleteButton}`}
                title="Delete"
              >
                Del
              </button>
            </div>
          </div>

          {/* Assignee display */}
          {assignee && (
            <div className={styles.cardAssignee}>
              <span
                className={styles.assigneeAvatar}
                style={{ backgroundColor: assignee.avatar }}
              >
                {assignee.name.charAt(0).toUpperCase()}
              </span>
              <span className={styles.assigneeName}>{assignee.name}</span>
            </div>
          )}

          {/* Options menu */}
          {showMenu && (
            <div ref={menuRef} className={styles.cardMenu}>
              <div className={styles.menuSection}>
                <span className={styles.menuLabel}>Priority</span>
                <div className={styles.priorityOptions}>
                  {(["high", "medium", "low", "none"] as Priority[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePriorityChange(p)}
                      className={`${styles.priorityOption} ${styles[`priority${p.charAt(0).toUpperCase() + p.slice(1)}Option`]} ${card.priority === p ? styles.prioritySelected : ""}`}
                    >
                      {p === "none" ? "—" : p.charAt(0).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.menuSection}>
                <span className={styles.menuLabel}>Assignee</span>
                <div className={styles.assigneeOptions}>
                  <button
                    onClick={() => handleAssigneeChange(undefined)}
                    className={`${styles.assigneeOption} ${!card.assigneeId ? styles.assigneeSelected : ""}`}
                  >
                    <span className={styles.assigneeOptionNone}>—</span>
                    Unassigned
                  </button>
                  {teamMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleAssigneeChange(member.id)}
                      className={`${styles.assigneeOption} ${card.assigneeId === member.id ? styles.assigneeSelected : ""}`}
                    >
                      <span
                        className={styles.assigneeOptionAvatar}
                        style={{ backgroundColor: member.avatar }}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.menuSection}>
                <span className={styles.menuLabel}>Labels</span>
                <div className={styles.labelOptions}>
                  {labels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => handleLabelToggle(label.id)}
                      className={`${styles.labelOption} ${card.labels.includes(label.id) ? styles.labelSelected : ""}`}
                      style={{ "--label-color": label.color } as React.CSSProperties}
                    >
                      <span
                        className={styles.labelDot}
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
