"use client";

import { useState } from "react";
import { TodoItem } from "@/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import styles from "./styles.module.css";

interface TodoListProps {
  teamId: string;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export default function TodoList({ teamId }: TodoListProps) {
  const [todos, setTodos] = useLocalStorage<TodoItem[]>(`vibe-pm-todos-${teamId}`, []);
  const [newTodoText, setNewTodoText] = useState("");

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      setTodos((prev) => [
        ...prev,
        { id: generateId(), text: newTodoText.trim(), completed: false },
      ]);
      setNewTodoText("");
    }
  };

  const handleToggle = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const handleDelete = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Quick Tasks</span>
      </div>
      <div className={styles.list}>
        {todos.length === 0 ? (
          <div className={styles.emptyState}>No tasks yet</div>
        ) : (
          todos.map((todo) => (
            <div key={todo.id} className={styles.item}>
              <button
                onClick={() => handleToggle(todo.id)}
                className={`${styles.checkbox} ${todo.completed ? styles.checkboxChecked : ""}`}
              >
                {todo.completed && <span className={styles.checkmark}>✓</span>}
              </button>
              <span className={`${styles.text} ${todo.completed ? styles.textCompleted : ""}`}>
                {todo.text}
              </span>
              <button
                onClick={() => handleDelete(todo.id)}
                className={styles.deleteButton}
              >
                Del
              </button>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleAddTodo} className={styles.addForm}>
        <input
          type="text"
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          placeholder="Add a task..."
          className={styles.input}
        />
        <button type="submit" className={styles.addButton}>
          Add
        </button>
      </form>
    </div>
  );
}
