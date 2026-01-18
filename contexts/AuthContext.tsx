"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useMemo } from "react";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { User, Team, Profile, AVATAR_COLORS } from "@/types";

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  teams: Team[];
  currentTeam: Team | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  createTeam: (name: string) => Promise<Team | null>;
  switchTeam: (teamId: string) => void;
  getTeamMembers: (teamId: string) => Promise<User[]>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  // Helper to create user object from session
  const createUserFromSession = (sessionUser: SupabaseUser): User => ({
    id: sessionUser.id,
    name: sessionUser.user_metadata?.name || sessionUser.email?.split("@")[0] || "User",
    email: sessionUser.email || "",
    avatar: sessionUser.user_metadata?.avatar_color || "#d4a574",
  });

  // Fetch user's teams (non-blocking)
  const loadTeams = useCallback(async (userId: string) => {
    try {
      const { data: memberData } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId);

      if (!memberData || memberData.length === 0) {
        setTeams([]);
        setCurrentTeam(null);
        return;
      }

      const teamIds = memberData.map((m: { team_id: string }) => m.team_id);
      const { data: teamsData } = await supabase
        .from("teams")
        .select("*")
        .in("id", teamIds);

      const userTeams = teamsData || [];
      setTeams(userTeams);

      // Restore last selected team or use first team
      const savedTeamId = localStorage.getItem("vibe-pm-current-team");
      const teamToSelect = userTeams.find((t) => t.id === savedTeamId) || userTeams[0];
      setCurrentTeam(teamToSelect || null);
    } catch (error) {
      console.error("Error loading teams:", error);
    }
  }, [supabase]);

  // Fetch and update user profile (non-blocking)
  const loadProfile = useCallback(async (userId: string, email: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profile) {
        setUser({
          id: profile.id,
          name: profile.name,
          email: email,
          avatar: profile.avatar_color,
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  }, [supabase]);

  // Handle session changes
  const handleSession = useCallback((session: Session | null) => {
    if (session?.user) {
      // Set user immediately from session data
      setSupabaseUser(session.user);
      setUser(createUserFromSession(session.user));
      setIsLoading(false);

      // Load additional data in background (non-blocking)
      loadProfile(session.user.id, session.user.email || "");
      loadTeams(session.user.id);
    } else {
      setSupabaseUser(null);
      setUser(null);
      setTeams([]);
      setCurrentTeam(null);
      setIsLoading(false);
    }
  }, [loadProfile, loadTeams]);

  // Initialize auth
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase, handleSession]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Set user immediately
    if (data.session?.user) {
      handleSession(data.session);
    }

    return { success: true };
  };

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          avatar_color: avatarColor,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("vibe-pm-current-team");
    window.location.href = "/login";
  };

  const createTeam = async (name: string): Promise<Team | null> => {
    if (!supabaseUser) return null;

    // Ensure profile exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", supabaseUser.id)
      .single();

    if (!profile) {
      await supabase.from("profiles").insert({
        id: supabaseUser.id,
        name: supabaseUser.user_metadata?.name || supabaseUser.email?.split("@")[0] || "User",
        avatar_color: "#d4a574",
      });
    }

    const { data: team, error } = await supabase
      .from("teams")
      .insert({
        name,
        owner_id: supabaseUser.id,
      })
      .select()
      .single();

    if (error || !team) {
      console.error("Error creating team:", error);
      return null;
    }

    setTeams((prev) => [...prev, team]);
    setCurrentTeam(team);
    localStorage.setItem("vibe-pm-current-team", team.id);
    return team;
  };

  const switchTeam = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (team) {
      setCurrentTeam(team);
      localStorage.setItem("vibe-pm-current-team", teamId);
    }
  };

  const getTeamMembers = async (teamId: string): Promise<User[]> => {
    const { data: members } = await supabase
      .from("team_members")
      .select(`
        user_id,
        profile:profiles(id, name, avatar_color)
      `)
      .eq("team_id", teamId);

    if (!members) return [];

    return members.map((m: { user_id: string; profile: unknown }) => {
      const profile = m.profile as Profile;
      return {
        id: profile.id,
        name: profile.name,
        email: "",
        avatar: profile.avatar_color,
      };
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        teams,
        currentTeam,
        isLoading,
        login,
        register,
        logout,
        createTeam,
        switchTeam,
        getTeamMembers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
