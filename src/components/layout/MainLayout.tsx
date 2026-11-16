import type { ReactNode } from "react";
import { AuthProvider } from "../../features/auth";
import { useAuth } from "../../features/auth";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </AuthProvider>
  );
}

function MainLayoutContent({ children }: { children: ReactNode }) {
  const { loading, error } = useAuth();

  return (
    <>
      {loading ? (
        <div className="flex min-h-screen items-center justify-center">
          Connexion en cours...
        </div>
      ) : error ? (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <h1 className="font-bold">Utilisateur non chargé</h1>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        </div>
      ) : (
        <>{children}</>
      )}
    </>
  );
}
