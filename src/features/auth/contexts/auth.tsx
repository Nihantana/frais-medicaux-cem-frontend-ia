import { useEffect, useState, type ReactNode } from "react";
import { fetchMe } from "../services/auth";
import { initializeKeycloak, logoutKeycloak } from "../services/keycloak";
import type { User } from "../../../types/auth";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    initializeKeycloak()
      .then(() => fetchMe())
      .then((data) => {
        if (!cancelled) {
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

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        loading,
        error,
        logout: logoutKeycloak,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
