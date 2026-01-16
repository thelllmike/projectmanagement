"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Team, AVATAR_COLORS } from "@/types";

interface AuthContextType {
  user: User | null;
  users: User[];
  teams: Team[];
  currentTeam: Team | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  createTeam: (name: string) => Team;
  joinTeam: (teamId: string) => boolean;
  switchTeam: (teamId: string) => void;
  getTeamMembers: (teamId: string) => User[];
  inviteToTeam: (teamId: string, email: string) => { success: boolean; error?: string };
}

const AuthContext = createContext<AuthContextType | null>(null);

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

interface StoredUser extends User {
  password: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from localStorage on mount
  useEffect(() => {
    const storedUsers = localStorage.getItem("vibe-pm-users");
    const storedTeams = localStorage.getItem("vibe-pm-teams");
    const storedCurrentUser = localStorage.getItem("vibe-pm-current-user");
    const storedCurrentTeam = localStorage.getItem("vibe-pm-current-team");

    if (storedUsers) setUsers(JSON.parse(storedUsers));
    if (storedTeams) setTeams(JSON.parse(storedTeams));
    if (storedCurrentUser) setUser(JSON.parse(storedCurrentUser));
    if (storedCurrentTeam) setCurrentTeam(JSON.parse(storedCurrentTeam));

    setIsLoading(false);
  }, []);

  // Save users to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem("vibe-pm-users", JSON.stringify(users));
    }
  }, [users, isLoading]);

  // Save teams to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem("vibe-pm-teams", JSON.stringify(teams));
    }
  }, [teams, isLoading]);

  // Save current user to localStorage
  useEffect(() => {
    if (!isLoading) {
      if (user) {
        localStorage.setItem("vibe-pm-current-user", JSON.stringify(user));
      } else {
        localStorage.removeItem("vibe-pm-current-user");
      }
    }
  }, [user, isLoading]);

  // Save current team to localStorage
  useEffect(() => {
    if (!isLoading) {
      if (currentTeam) {
        localStorage.setItem("vibe-pm-current-team", JSON.stringify(currentTeam));
      } else {
        localStorage.removeItem("vibe-pm-current-team");
      }
    }
  }, [currentTeam, isLoading]);

  const login = async (email: string, password: string) => {
    const foundUser = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!foundUser) {
      return { success: false, error: "Invalid email or password" };
    }

    const { password: _, ...userWithoutPassword } = foundUser;
    setUser(userWithoutPassword);

    // Set first team as current if user has teams
    if (foundUser.teamIds.length > 0) {
      const firstTeam = teams.find((t) => t.id === foundUser.teamIds[0]);
      if (firstTeam) setCurrentTeam(firstTeam);
    }

    return { success: true };
  };

  const register = async (name: string, email: string, password: string) => {
    // Check if email already exists
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: "Email already registered" };
    }

    const newUser: StoredUser = {
      id: generateId(),
      name,
      email,
      password,
      avatar: getRandomColor(),
      teamIds: [],
    };

    setUsers((prev) => [...prev, newUser]);

    // Auto-login after registration
    const { password: _, ...userWithoutPassword } = newUser;
    setUser(userWithoutPassword);

    return { success: true };
  };

  const logout = () => {
    setUser(null);
    setCurrentTeam(null);
  };

  const createTeam = (name: string): Team => {
    if (!user) throw new Error("Must be logged in to create a team");

    const newTeam: Team = {
      id: generateId(),
      name,
      ownerId: user.id,
      memberIds: [user.id],
      createdAt: Date.now(),
    };

    setTeams((prev) => [...prev, newTeam]);

    // Update user's teamIds
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, teamIds: [...u.teamIds, newTeam.id] } : u
      )
    );

    // Update current user
    setUser((prev) =>
      prev ? { ...prev, teamIds: [...prev.teamIds, newTeam.id] } : prev
    );

    // Set as current team
    setCurrentTeam(newTeam);

    return newTeam;
  };

  const joinTeam = (teamId: string): boolean => {
    if (!user) return false;

    const team = teams.find((t) => t.id === teamId);
    if (!team) return false;

    // Already a member
    if (team.memberIds.includes(user.id)) return true;

    // Add user to team
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId ? { ...t, memberIds: [...t.memberIds, user.id] } : t
      )
    );

    // Add team to user
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, teamIds: [...u.teamIds, teamId] } : u
      )
    );

    setUser((prev) =>
      prev ? { ...prev, teamIds: [...prev.teamIds, teamId] } : prev
    );

    return true;
  };

  const switchTeam = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (team && user?.teamIds.includes(teamId)) {
      setCurrentTeam(team);
    }
  };

  const getTeamMembers = (teamId: string): User[] => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return [];

    return users
      .filter((u) => team.memberIds.includes(u.id))
      .map(({ password, ...user }) => user);
  };

  const inviteToTeam = (teamId: string, email: string) => {
    const invitedUser = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );

    if (!invitedUser) {
      return { success: false, error: "User not found" };
    }

    const team = teams.find((t) => t.id === teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    if (team.memberIds.includes(invitedUser.id)) {
      return { success: false, error: "User already in team" };
    }

    // Add user to team
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, memberIds: [...t.memberIds, invitedUser.id] }
          : t
      )
    );

    // Add team to user
    setUsers((prev) =>
      prev.map((u) =>
        u.id === invitedUser.id
          ? { ...u, teamIds: [...u.teamIds, teamId] }
          : u
      )
    );

    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        users: users.map(({ password, ...u }) => u),
        teams,
        currentTeam,
        isLoading,
        login,
        register,
        logout,
        createTeam,
        joinTeam,
        switchTeam,
        getTeamMembers,
        inviteToTeam,
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
