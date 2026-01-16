"use client";

import { useState, useEffect, useCallback } from "react";
import { TodoItem } from "@/types";
import { createClient } from "@/lib/supabase/client";
import styles from "./styles.module.css";

interface TodoListProps {
  teamId: string;
}

export default function TodoList({ teamId }: TodoListProps) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoText, setNewTodoText] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  // Fetch todos
  const fetchTodos = useCallback(async () => {
    const { data } = await supabase
      .from("todos")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });

    setTodos(data || []);
    setIsLoading(false);
  }, [teamId, supabase]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      const { data: todo, error } = await supabase
        .from("todos")
        .insert({
          team_id: teamId,
          text: newTodoText.trim(),
          completed: false,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding todo:", error);
        return;
      }

      setTodos((prev) => [...prev, todo]);
      setNewTodoText("");
    }
  };

  const handleToggle = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    const { error } = await supabase
      .from("todos")
      .update({ completed: !todo.completed, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Error toggling todo:", error);
      return;
    }

    setTodos((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t
      )
    );
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("todos")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting todo:", error);
      return;
    }

    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>Quick Tasks</span>
        </div>
        <div className={styles.list}>
          <div className={styles.emptyState}>Loading...</div>
        </div>
      </div>
    );
  }

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
