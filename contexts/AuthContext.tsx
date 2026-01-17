"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useMemo, useRef } from "react";
import { User as SupabaseUser, AuthChangeEvent, Session } from "@supabase/supabase-js";
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

  // Memoize supabase client to prevent infinite loops
  const supabase = useMemo(() => createClient(), []);

  // Fetch user profile
  const fetchProfile = useCallback(async (userId: string, email: string): Promise<User | null> => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profile) {
      return {
        id: profile.id,
        name: profile.name,
        email: email,
        avatar: profile.avatar_color,
      };
    }
    return null;
  }, [supabase]);

  // Fetch user's teams
  const fetchTeams = useCallback(async (userId: string): Promise<Team[]> => {
    const { data: memberData } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", userId);

    if (!memberData || memberData.length === 0) return [];

    const teamIds = memberData.map((m: { team_id: string }) => m.team_id);
    const { data: teamsData } = await supabase
      .from("teams")
      .select("*")
      .in("id", teamIds);

    return teamsData || [];
  }, [supabase]);

  // Track if auth has been initialized
  const authInitialized = useRef(false);

  // Initialize auth state
  useEffect(() => {
    // Prevent double initialization in strict mode
    if (authInitialized.current) return;
    authInitialized.current = true;

    const initAuth = async () => {
      try {
        // First try to get session (faster, uses cache)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          setSupabaseUser(session.user);

          try {
            const profile = await fetchProfile(session.user.id, session.user.email || "");
            setUser(profile);

            const userTeams = await fetchTeams(session.user.id);
            setTeams(userTeams);

            // Restore last selected team or use first team
            const savedTeamId = localStorage.getItem("vibe-pm-current-team");
            const teamToSelect = userTeams.find((t) => t.id === savedTeamId) || userTeams[0];
            setCurrentTeam(teamToSelect || null);
          } catch (profileError) {
            console.error("Error fetching profile/teams:", profileError);
            // User is authenticated but profile fetch failed - still allow access
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log("Auth state change:", event);

      if (event === "SIGNED_IN" && session?.user) {
        setSupabaseUser(session.user);
        try {
          const profile = await fetchProfile(session.user.id, session.user.email || "");
          setUser(profile);

          const userTeams = await fetchTeams(session.user.id);
          setTeams(userTeams);
          setCurrentTeam(userTeams[0] || null);
        } catch (error) {
          console.error("Error in SIGNED_IN handler:", error);
        }
        setIsLoading(false);
      } else if (event === "SIGNED_OUT") {
        setSupabaseUser(null);
        setUser(null);
        setTeams([]);
        setCurrentTeam(null);
        setIsLoading(false);
      } else if (event === "TOKEN_REFRESHED") {
        // Session was refreshed, user is still authenticated
        console.log("Token refreshed");
      } else if (event === "INITIAL_SESSION") {
        // Initial session loaded - handled by initAuth
        console.log("Initial session loaded");
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile, fetchTeams]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
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
  };

  const createTeam = async (name: string): Promise<Team | null> => {
    console.log("createTeam called with:", name);
    console.log("supabaseUser:", supabaseUser);

    if (!supabaseUser) {
      console.error("No supabaseUser - cannot create team");
      return null;
    }

    // First check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", supabaseUser.id)
      .single();

    console.log("Profile check:", profile, profileError);

    if (!profile) {
      console.error("No profile found for user - creating one");
      // Create profile if missing
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

    console.log("Team creation result:", team, error);

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
