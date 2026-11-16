import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  ClipboardList,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../features/auth";
import {
  listAuditActions,
  listUserSessions,
  streamAuditActions,
  type AuditAction,
  type AuditResult,
  type UserSessionStatus,
} from "../features/audit/services/audit";
import { ApiError } from "../services/api";
import { errorMessage } from "../utils/errors";

type AuditTab = "actions" | "sessions";
const PAGE_SIZE = 30;
const SESSION_REFRESH_INTERVAL = 30_000;

const dateTime = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

function resultLabel(result: AuditResult): string {
  if (result === "SUCCES") return "Succès";
  if (result === "ECHEC") return "Échec";
  return "En cours";
}

function resultStyle(result: AuditResult): string {
  if (result === "SUCCES") return "bg-emerald-50 text-emerald-700";
  if (result === "ECHEC") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

export default function AuditSessionsPage() {
  const { role } = useAuth();
  const [tab, setTab] = useState<AuditTab>("actions");
  const [actions, setActions] = useState<AuditAction[]>([]);
  const [sessions, setSessions] = useState<UserSessionStatus[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<AuditResult | "">("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<
    "inactif" | "connexion" | "connecte" | "reconnexion"
  >("inactif");
  const [highlightedActionId, setHighlightedActionId] = useState<number | null>(
    null,
  );
  const seenActionIds = useRef(new Set<number>());
  const highlightTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      if (role !== "ADMINISTRATEUR") return;
      setLoading(true);
      setError(null);
      try {
        if (tab === "actions") {
          const response = await listAuditActions({
            page,
            limit: PAGE_SIZE,
            q: search || undefined,
            resultat: resultFilter || undefined,
          });
          if (active) {
            setActions(response.items);
            setTotal(response.total);
            response.items.forEach((action) =>
              seenActionIds.current.add(action.id),
            );
          }
        } else {
          const response = await listUserSessions();
          if (active) setSessions(response);
        }
      } catch (cause) {
        if (active) {
          setError(
            tab === "sessions" &&
              cause instanceof ApiError &&
              cause.status === 503
              ? "Sessions Keycloak indisponibles. Vérifiez la configuration du compte de service et son rôle view-users côté serveur."
              : errorMessage(
                  cause,
                  tab === "actions"
                    ? "Impossible de charger le journal des actions."
                    : "Impossible de charger les sessions Keycloak.",
                ),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [page, reloadKey, resultFilter, role, search, tab]);

  useEffect(() => {
    if (role !== "ADMINISTRATEUR" || tab !== "actions" || loading) {
      return;
    }

    let active = true;
    let retrying = false;
    let controller: AbortController | null = null;
    let retryTimer: number | null = null;

    async function connect(): Promise<void> {
      if (!active) return;
      controller = new AbortController();
      setRealtimeStatus(retrying ? "reconnexion" : "connexion");
      try {
        await streamAuditActions(
          controller.signal,
          (action) => {
            if (!active || seenActionIds.current.has(action.id)) return;
            seenActionIds.current.add(action.id);

            const normalizedSearch = search.toLocaleLowerCase("fr");
            const matchesSearch =
              normalizedSearch === "" ||
              [
                action.utilisateurNom,
                action.utilisateurEmail,
                action.methode,
                action.route,
                action.cibleId,
              ].some((value) =>
                value?.toLocaleLowerCase("fr").includes(normalizedSearch),
              );
            if (
              !matchesSearch ||
              (resultFilter !== "" && action.resultat !== resultFilter)
            ) {
              return;
            }

            setTotal((current) => current + 1);
            if (page === 1) {
              setActions((current) =>
                [
                  action,
                  ...current.filter((item) => item.id !== action.id),
                ].slice(0, PAGE_SIZE),
              );
              setHighlightedActionId(action.id);
              if (highlightTimer.current !== null) {
                window.clearTimeout(highlightTimer.current);
              }
              highlightTimer.current = window.setTimeout(
                () => setHighlightedActionId(null),
                1400,
              );
            }
          },
          async () => {
            const response = await listAuditActions({
              page,
              limit: PAGE_SIZE,
              q: search || undefined,
              resultat: resultFilter || undefined,
            });
            if (!active) return;
            setActions(response.items);
            setTotal(response.total);
            response.items.forEach((action) =>
              seenActionIds.current.add(action.id),
            );
            setRealtimeStatus("connecte");
            setError(null);
            retrying = false;
          },
        );
        if (active) throw new Error("Le flux d’audit s’est fermé.");
      } catch (cause) {
        if (!active) return;
        retrying = true;
        setRealtimeStatus("reconnexion");
        setError(
          errorMessage(
            cause,
            "Connexion temps réel interrompue. Nouvelle tentative automatique…",
          ),
        );
        retryTimer = window.setTimeout(() => void connect(), 3_000);
      }
    }

    void connect();
    return () => {
      active = false;
      controller?.abort();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (highlightTimer.current !== null) {
        window.clearTimeout(highlightTimer.current);
        highlightTimer.current = null;
      }
    };
  }, [loading, page, resultFilter, role, search, tab]);

  useEffect(() => {
    if (role !== "ADMINISTRATEUR" || tab !== "sessions") return;

    let active = true;
    let refreshTimer: number;
    async function refreshSessions(): Promise<void> {
      try {
        const response = await listUserSessions();
        if (active) {
          setSessions(response);
          setError(null);
        }
      } catch (cause) {
        if (active) {
          setError(
            errorMessage(
              cause,
              "Impossible d’actualiser les sessions Keycloak.",
            ),
          );
        }
      } finally {
        if (active) {
          refreshTimer = window.setTimeout(
            () => void refreshSessions(),
            SESSION_REFRESH_INTERVAL,
          );
        }
      }
    }

    refreshTimer = window.setTimeout(
      () => void refreshSessions(),
      SESSION_REFRESH_INTERVAL,
    );
    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
    };
  }, [role, tab]);

  if (role !== "ADMINISTRATEUR") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        Accès réservé aux administrateurs.
      </div>
    );
  }

  function applyFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleRealtimeStatus = loading ? "connexion" : realtimeStatus;

  return (
    <div className="audit-page-enter space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-red-700">
            <Activity size={17} /> Sécurité et traçabilité
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">
            Audit et sessions
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Consultez les actions enregistrées et les sessions Keycloak actives.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {tab === "actions" && (
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600"
            >
              <span
                className={`audit-live-dot ${visibleRealtimeStatus === "connecte" ? "is-active" : ""}`}
              />
              {visibleRealtimeStatus === "connecte"
                ? "Temps réel actif"
                : visibleRealtimeStatus === "reconnexion"
                  ? "Reconnexion…"
                  : visibleRealtimeStatus === "connexion"
                    ? "Connexion…"
                    : "Temps réel en pause"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={loading}
            className="btn-secondary"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Actualiser
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {(
          [
            {
              id: "actions",
              label: "Journal des actions",
              icon: ClipboardList,
            },
            { id: "sessions", label: "Sessions Keycloak", icon: Users },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              tab === id
                ? "border-red-600 text-red-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === "actions" && (
        <form
          onSubmit={applyFilters}
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row"
        >
          <label className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Utilisateur, route ou identifiant cible"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
            />
          </label>
          <select
            value={resultFilter}
            onChange={(event) => {
              setPage(1);
              setResultFilter(event.target.value as AuditResult | "");
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-red-300"
            aria-label="Filtrer par résultat"
          >
            <option value="">Tous les résultats</option>
            <option value="SUCCES">Succès</option>
            <option value="ECHEC">Échec</option>
            <option value="EN_COURS">En cours</option>
          </select>
          <button type="submit" className="btn-primary justify-center">
            <Search size={16} /> Rechercher
          </button>
        </form>
      )}

      {tab === "sessions" && (
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Le statut est calculé à partir des sessions Keycloak du client de
          l’application et actualisé automatiquement toutes les 30 secondes.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {tab === "actions" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-900">Actions récentes</h2>
            <span className="text-xs font-medium text-slate-500">
              {total.toLocaleString("fr-FR")} résultat{total > 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Utilisateur</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 font-semibold">Cible</th>
                  <th className="px-5 py-3 font-semibold">Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actions.map((action) => (
                  <tr
                    key={action.id}
                    className={`hover:bg-slate-50/70 ${
                      highlightedActionId === action.id ? "audit-row-enter" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {dateTime(action.creeLe)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-800">
                        {action.utilisateurNom}
                      </div>
                      <div className="text-xs text-slate-500">
                        {action.utilisateurEmail ?? "Adresse inconnue"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <code className="rounded bg-slate-100 px-1.5 py-1 text-xs font-semibold text-slate-700">
                        {action.methode}
                      </code>
                      <div className="mt-1 break-all font-mono text-xs text-slate-600">
                        {action.route}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {action.cibleId ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${resultStyle(action.resultat)}`}
                      >
                        {action.resultat === "SUCCES" ? (
                          <CircleCheck size={14} />
                        ) : action.resultat === "ECHEC" ? (
                          <CircleX size={14} />
                        ) : (
                          <Activity size={14} />
                        )}
                        {resultLabel(action.resultat)}
                        {action.statutHttp !== null &&
                          ` · ${action.statutHttp}`}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && actions.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      Aucune action ne correspond aux filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <span className="text-xs text-slate-500">
              Page {page} sur {pageCount}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                aria-label="Page précédente"
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(pageCount, current + 1))
                }
                disabled={page >= pageCount || loading}
                aria-label="Page suivante"
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-900">Comptes utilisateurs</h2>
            <span className="text-xs font-medium text-slate-500">
              {sessions.filter((session) => session.connecte).length} connecté
              {sessions.filter((session) => session.connecte).length > 1
                ? "s"
                : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Utilisateur</th>
                  <th className="px-5 py-3 font-semibold">État</th>
                  <th className="px-5 py-3 font-semibold">Sessions</th>
                  <th className="px-5 py-3 font-semibold">Connecté depuis</th>
                  <th className="px-5 py-3 font-semibold">Dernière activité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-800">
                        {session.nom}
                      </div>
                      <div className="text-xs text-slate-500">
                        {session.email ?? "Adresse inconnue"} · {session.role}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                          session.connecte
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {session.connecte ? (
                          <CircleCheck size={14} />
                        ) : (
                          <CircleX size={14} />
                        )}
                        {session.connecte ? "Connecté" : "Déconnecté"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {session.nombreSessions}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {dateTime(session.connecteDepuis)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {dateTime(session.derniereActivite)}
                    </td>
                  </tr>
                ))}
                {!loading && sessions.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {loading && (
        <p role="status" className="text-center text-sm text-slate-500">
          Chargement…
        </p>
      )}
    </div>
  );
}
