"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import styles from "./page.module.css";
import TodoList from "@/components/TodoList/TodoList";
import Notes from "@/components/Notes/Notes";
import { useAuth } from "@/contexts/AuthContext";

const KanbanBoard = dynamic(
  () => import("@/components/KanbanBoard/KanbanBoard"),
  { ssr: false }
);

export default function Home() {
  const { user, teams, currentTeam, isLoading, logout, createTeam, switchTeam } = useAuth();
  const router = useRouter();
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTeamName.trim()) {
      await createTeam(newTeamName.trim());
      setNewTeamName("");
      setShowCreateTeam(false);
      setShowTeamMenu(false);
    }
  };

  // Teams are already filtered by user membership from AuthContext
  const userTeams = teams;

  // Only show brief loading on initial page load, not after login
  if (isLoading && !user) {
    return (
      <div className={styles.loadingContainer}>
        <span className={styles.loadingText}>Loading...</span>
      </div>
    );
  }

  // Middleware handles redirect to /login, but fallback just in case
  if (!user) {
    // Don't show anything, middleware will redirect
    return null;
  }

  // Show create team screen if user has no teams
  if (userTeams.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.onboarding}>
          <h1 className={styles.onboardingTitle}>Welcome to Vibe PM</h1>
          <p className={styles.onboardingText}>
            Create your first workspace to get started
          </p>
          <form onSubmit={handleCreateTeam} className={styles.onboardingForm}>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Workspace name"
              className={styles.onboardingInput}
              autoFocus
            />
            <button type="submit" className={styles.onboardingButton}>
              Create Workspace
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>Vibe PM</span>

          {/* Team selector */}
          <div className={styles.teamSelector}>
            <button
              onClick={() => setShowTeamMenu(!showTeamMenu)}
              className={styles.teamButton}
            >
              <span className={styles.teamName}>{currentTeam?.name || "Select workspace"}</span>
              <span className={styles.teamArrow}>▾</span>
            </button>

            {showTeamMenu && (
              <div className={styles.teamMenu}>
                <div className={styles.teamMenuHeader}>Workspaces</div>
                {userTeams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => {
                      switchTeam(team.id);
                      setShowTeamMenu(false);
                    }}
                    className={`${styles.teamMenuItem} ${currentTeam?.id === team.id ? styles.teamMenuItemActive : ""}`}
                  >
                    {team.name}
                  </button>
                ))}
                <div className={styles.teamMenuDivider} />
                {showCreateTeam ? (
                  <form onSubmit={handleCreateTeam} className={styles.createTeamForm}>
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="Workspace name"
                      className={styles.createTeamInput}
                      autoFocus
                    />
                    <div className={styles.createTeamActions}>
                      <button type="submit" className={styles.createTeamSubmit}>
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateTeam(false);
                          setNewTeamName("");
                        }}
                        className={styles.createTeamCancel}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowCreateTeam(true)}
                    className={styles.teamMenuCreate}
                  >
                    + New workspace
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.userInfo}>
            <span
              className={styles.userAvatar}
              style={{ backgroundColor: user.avatar }}
            >
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className={styles.userName}>{user.name}</span>
          </div>
          <button onClick={logout} className={styles.logoutButton}>
            Sign out
          </button>
        </div>
      </header>

      {currentTeam ? (
        <main className={styles.main}>
          <section className={styles.kanbanSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Board</span>
            </div>
            <div className={styles.kanbanWrapper}>
              <KanbanBoard teamId={currentTeam.id} />
            </div>
          </section>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarSection}>
              <TodoList teamId={currentTeam.id} />
            </div>
            <div className={styles.sidebarSection}>
              <Notes teamId={currentTeam.id} />
            </div>
          </aside>
        </main>
      ) : (
        <div className={styles.noTeam}>
          <p>Select a workspace to get started</p>
        </div>
      )}
    </div>
  );
}
