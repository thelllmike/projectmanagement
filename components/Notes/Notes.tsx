"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./styles.module.css";

interface NotesProps {
  teamId: string;
}

export default function Notes({ teamId }: NotesProps) {
  const [notes, setNotes] = useState<string>("");
  const [showSaved, setShowSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const supabase = createClient();

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from("notes")
      .select("content")
      .eq("team_id", teamId)
      .single();

    setNotes(data?.content || "");
    setIsLoading(false);
  }, [teamId, supabase]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Auto-save with debounce
  const saveNotes = useCallback(async (content: string) => {
    const { error } = await supabase
      .from("notes")
      .upsert(
        { team_id: teamId, content, updated_at: new Date().toISOString() },
        { onConflict: "team_id" }
      );

    if (error) {
      console.error("Error saving notes:", error);
      return;
    }

    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  }, [teamId, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setNotes(newContent);

    // Debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveNotes(newContent);
    }, 500);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>Notes</span>
        </div>
        <div className={styles.textareaWrapper}>
          <div style={{ padding: "1rem", color: "var(--text-muted)" }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Notes</span>
        <div className={`${styles.indicator} ${showSaved ? styles.indicatorVisible : ""}`} />
      </div>
      <div className={styles.textareaWrapper}>
        <textarea
          value={notes}
          onChange={handleChange}
          placeholder="Capture your thoughts..."
          className={styles.textarea}
        />
      </div>
    </div>
  );
}
