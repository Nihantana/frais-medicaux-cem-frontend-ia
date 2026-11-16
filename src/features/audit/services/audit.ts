import { getKeycloakAccessToken } from "../../auth/services/keycloak";
import { API_BASE_URL, apiService } from "../../../services/api";

export type AuditResult = "SUCCES" | "ECHEC" | "EN_COURS";

export interface AuditAction {
  id: number;
  utilisateurId: number;
  utilisateurNom: string;
  utilisateurEmail: string | null;
  methode: string;
  route: string;
  cibleId: string | null;
  statutHttp: number | null;
  resultat: AuditResult;
  creeLe: string;
  termineLe: string | null;
}

export interface AuditActionsPage {
  items: AuditAction[];
  total: number;
  page: number;
  limit: number;
}

export interface UserSessionStatus {
  id: number;
  nom: string;
  email: string | null;
  role: string;
  connecte: boolean;
  nombreSessions: number;
  connecteDepuis: string | null;
  derniereActivite: string | null;
}

function isAuditAction(value: unknown): value is AuditAction {
  if (typeof value !== "object" || value === null) return false;
  const action = value as Record<string, unknown>;
  return (
    typeof action.id === "number" &&
    typeof action.utilisateurId === "number" &&
    typeof action.utilisateurNom === "string" &&
    (typeof action.utilisateurEmail === "string" ||
      action.utilisateurEmail === null) &&
    typeof action.methode === "string" &&
    typeof action.route === "string" &&
    (typeof action.cibleId === "string" || action.cibleId === null) &&
    (typeof action.statutHttp === "number" || action.statutHttp === null) &&
    (action.resultat === "SUCCES" || action.resultat === "ECHEC") &&
    typeof action.creeLe === "string" &&
    (typeof action.termineLe === "string" || action.termineLe === null)
  );
}

export async function streamAuditActions(
  signal: AbortSignal,
  onAction: (action: AuditAction) => void,
  onConnected: () => Promise<void> | void,
): Promise<void> {
  const token = await getKeycloakAccessToken();
  const response = await fetch(
    `${API_BASE_URL.replace(/\/+$/, "")}/audit/actions/stream`,
    {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(
      `Connexion au flux d’audit refusée (HTTP ${response.status}).`,
    );
  }
  if (response.body === null) {
    throw new Error("Le flux temps réel d’audit est indisponible.");
  }

  await onConnected();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });

      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const data = block
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) continue;

        const payload: unknown = JSON.parse(data);
        if (isAuditAction(payload)) onAction(payload);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function listAuditActions(params: {
  page: number;
  limit: number;
  q?: string;
  resultat?: AuditResult;
}): Promise<AuditActionsPage> {
  return apiService.get<AuditActionsPage>("/audit/actions", { params });
}

export function listUserSessions(): Promise<UserSessionStatus[]> {
  return apiService.get<UserSessionStatus[]>("/audit/sessions");
}
