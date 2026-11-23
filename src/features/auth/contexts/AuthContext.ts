import { createContext } from "react";
import type { User, Role } from "../../../types/auth";

export interface AuthContextValue {
  user: User | null;
  role: Role | null;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  loading: boolean;
  error: string | null;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
