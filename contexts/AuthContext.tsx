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

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      console.log("initAuth starting...");
      try {
        // First try to get session (faster, uses cache)
        console.log("Getting session...");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log("Session result:", session ? "has session" : "no session", sessionError);

        if (!isMounted) return;

        if (sessionError) {
          console.error("Session error:", sessionError);
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          console.log("User found, setting supabaseUser...");
          setSupabaseUser(session.user);

          // Create minimal user immediately to prevent loading state
          const minimalUser = {
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User",
            email: session.user.email || "",
            avatar: session.user.user_metadata?.avatar_color || "#d4a574",
          };
          setUser(minimalUser);
          console.log("Minimal user set:", minimalUser.name);

          // Now try to fetch full profile (non-blocking)
          try {
            const profile = await fetchProfile(session.user.id, session.user.email || "");
            if (isMounted && profile) {
              setUser(profile);
              console.log("Full profile loaded");
            }

            const userTeams = await fetchTeams(session.user.id);
            if (isMounted) {
              setTeams(userTeams);
              const savedTeamId = localStorage.getItem("vibe-pm-current-team");
              const teamToSelect = userTeams.find((t) => t.id === savedTeamId) || userTeams[0];
              setCurrentTeam(teamToSelect || null);
              console.log("Teams loaded:", userTeams.length);
            }
          } catch (profileError) {
            console.error("Error fetching profile/teams:", profileError);
            // User already set with minimal data, so this is fine
          }
        } else {
          console.log("No session, user not logged in");
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        if (isMounted) {
          console.log("Setting isLoading to false");
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log("Auth state change:", event);

      if (event === "SIGNED_IN" && session?.user) {
        setIsLoading(true); // Show loading while fetching profile/teams
        setSupabaseUser(session.user);
        try {
          const profile = await fetchProfile(session.user.id, session.user.email || "");
          // If profile fetch failed, create a minimal user object
          if (profile) {
            setUser(profile);
          } else {
            setUser({
              id: session.user.id,
              name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User",
              email: session.user.email || "",
              avatar: session.user.user_metadata?.avatar_color || "#d4a574",
            });
          }

          const userTeams = await fetchTeams(session.user.id);
          setTeams(userTeams);
          setCurrentTeam(userTeams[0] || null);
        } catch (error) {
          console.error("Error in SIGNED_IN handler:", error);
          // Still set a minimal user so app doesn't get stuck
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User",
            email: session.user.email || "",
            avatar: "#d4a574",
          });
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

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile, fetchTeams]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    console.log("Login attempt for:", email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    }

    console.log("Login successful, session:", data.session ? "exists" : "missing");

    // Immediately set the user to prevent loading state
    if (data.session?.user) {
      setSupabaseUser(data.session.user);
      setUser({
        id: data.session.user.id,
        name: data.session.user.user_metadata?.name || data.session.user.email?.split("@")[0] || "User",
        email: data.session.user.email || "",
        avatar: data.session.user.user_metadata?.avatar_color || "#d4a574",
      });
      setIsLoading(false);
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
    // Full page refresh to ensure clean state
    window.location.href = "/login";
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
