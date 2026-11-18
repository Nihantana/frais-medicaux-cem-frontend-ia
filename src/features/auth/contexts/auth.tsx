import { useEffect, useState, type ReactNode } from "react";
import { fetchMe } from "../services/auth";
import { initializeKeycloak, logoutKeycloak } from "../services/keycloak";
import type { User } from "../../../types/auth";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  async function refreshUser(): Promise<void> {
    setUser(await fetchMe());
  }

  function setTheme(nextTheme: "light" | "dark"): void {
    setThemeState(nextTheme);
    if (user !== null) {
      localStorage.setItem(`theme:${user.id}`, nextTheme);
    }
  }

  useEffect(() => {
    let cancelled = false;

    initializeKeycloak()
      .then(() => fetchMe())
      .then((data) => {
        if (!cancelled) {
          setThemeState(
            localStorage.getItem(`theme:${data.id}`) === "dark"
              ? "dark"
              : "light",
          );
          setUser(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setUser(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Impossible de charger l'utilisateur connecté.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        loading,
        error,
        theme,
        setTheme,
        refreshUser,
        logout: logoutKeycloak,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
