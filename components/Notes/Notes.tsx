"use client";

import { useState, useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import styles from "./styles.module.css";

interface NotesProps {
  teamId: string;
}

export default function Notes({ teamId }: NotesProps) {
  const [notes, setNotes] = useLocalStorage<string>(`vibe-pm-notes-${teamId}`, "");
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (notes) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [notes]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Notes</span>
        <div className={`${styles.indicator} ${showSaved ? styles.indicatorVisible : ""}`} />
      </div>
      <div className={styles.textareaWrapper}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Capture your thoughts..."
          className={styles.textarea}
        />
      </div>
    </div>
  );
}
