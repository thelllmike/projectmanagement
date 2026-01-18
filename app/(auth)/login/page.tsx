"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import styles from "../auth.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const searchParams = useSearchParams();

  // Handle email confirmation code
  useEffect(() => {
    const handleCodeExchange = async () => {
      const code = searchParams.get("code");
      if (code) {
        const supabase = createClient();
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError("Email confirmation failed: " + exchangeError.message);
        } else {
          // Full page refresh to ensure auth state is properly loaded
          window.location.href = "/";
        }
      }
    };
    handleCodeExchange();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await login(email, password);

    if (result.success) {
      // Wait for session to be saved to cookies
      const supabase = createClient();

      // Poll for session to be ready (max 3 seconds)
      let attempts = 0;
      while (attempts < 6) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log("Session confirmed, redirecting...");
          window.location.href = "/";
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      // Fallback: redirect anyway after timeout
      console.log("Session not confirmed, redirecting anyway...");
      window.location.href = "/";
      return;
    } else {
      setError(result.error || "Login failed");
    }

    setIsSubmitting(false);
  };

  return (
    <>
      <h1 className={styles.title}>Welcome back</h1>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            placeholder="Enter your password"
            required
          />
        </div>

        <button type="submit" className={styles.button} disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className={styles.footer}>
        Don&apos;t have an account?{" "}
        <Link href="/register" className={styles.link}>
          Create one
        </Link>
      </p>
    </>
  );
}
