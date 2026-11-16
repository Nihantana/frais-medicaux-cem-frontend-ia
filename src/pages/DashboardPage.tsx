import { AlertTriangle, ArrowRight, BadgeDollarSign, CheckCircle2, ClipboardList, RefreshCw, Users, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorBlock, LoadingState, PageHeader } from "../components/ui";
import { getPaieMois } from "../features/invoice/services/paieAPI";
import { getFactures } from "../features/invoice/services/serviceAPI";
import { mapFacturesGlobalesResponse } from "../features/invoice/services/mapFactureGlobaleResponse";
import type { FactureGlobaleRow } from "../features/invoice/types/invoiceTable";

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MGA", maximumFractionDigits: 0 });
const dateFromDisplay = (value: string) => { const [day, month, year] = value.split("/").map(Number); return day && month && year ? new Date(year, month - 1, day) : null; };
const daysSince = (value: string) => { const date = dateFromDisplay(value); return date ? Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000)) : null; };
const statusLabel: Record<string, string> = { ENREGISTREE: "À traiter", EN_VALIDATION: "En validation", A_CORRIGER: "À corriger", RETOURNEE: "Retournée", VALIDEE: "Validée", SORTIE: "Sortie" };
const statusClass: Record<string, string> = { ENREGISTREE: "bg-slate-100 text-slate-700", EN_VALIDATION: "bg-blue-100 text-blue-700", A_CORRIGER: "bg-amber-100 text-amber-800", RETOURNEE: "bg-amber-100 text-amber-800", VALIDEE: "bg-emerald-100 text-emerald-700", SORTIE: "bg-violet-100 text-violet-700" };

export default function DashboardPage() {
  const [factures, setFactures] = useState<FactureGlobaleRow[] | null>(null);
  const [totalPaie, setTotalPaie] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [resultatFactures, resultatPaies] = await Promise.allSettled([getFactures(), getPaieMois()]);
      const erreurs: string[] = [];

      if (resultatFactures.status === "fulfilled") {
        setFactures(mapFacturesGlobalesResponse(resultatFactures.value));
      } else {
        erreurs.push(`Factures : ${resultatFactures.reason instanceof Error ? resultatFactures.reason.message : "chargement impossible."}`);
      }

      if (resultatPaies.status === "fulfilled") {
        setTotalPaie(resultatPaies.value.reduce((total, paie) => total + Number(paie.totalAgent || 0), 0));
      } else {
        setTotalPaie(null);
        erreurs.push(`Paie : ${resultatPaies.reason instanceof Error ? resultatPaies.reason.message : "chargement impossible."}`);
      }
      setError(erreurs.length > 0 ? erreurs.join(" ") : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les indicateurs.");
    } finally {
      setLoading(false);
    }
  }

  function refresh() {
    setLoading(true);
    setError(null);
    void load();
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const dashboard = useMemo(() => {
    const rows = factures ?? [];
    const count = (statuses: string[]) => rows.filter((row) => statuses.includes(row.statut)).length;
    const statusCounts = ["ENREGISTREE", "EN_VALIDATION", "A_CORRIGER", "RETOURNEE", "VALIDEE", "SORTIE"].map((status) => ({ status, count: count([status]) }));
    const max = Math.max(1, ...statusCounts.map((item) => item.count));
    const priorityStatuses = new Set(["ENREGISTREE", "EN_VALIDATION", "A_CORRIGER", "RETOURNEE"]);
    const priorities = rows.filter((row) => priorityStatuses.has(row.statut)).sort((left, right) => {
      const leftTime = dateFromDisplay(left.dateReception)?.getTime();
      const rightTime = dateFromDisplay(right.dateReception)?.getTime();
      if (leftTime === undefined) return rightTime === undefined ? 0 : 1;
      if (rightTime === undefined) return -1;
      return leftTime - rightTime;
    }).slice(0, 8);
    return { rows, statusCounts, max, priorities, toProcess: count(["ENREGISTREE"]), awaiting: count(["EN_VALIDATION"]), correction: count(["A_CORRIGER", "RETOURNEE"]), validated: count(["VALIDEE", "SORTIE"]), cem: rows.reduce((total, row) => total + row.partCem100 + row.partCem80, 0), agent: rows.reduce((total, row) => total + row.totalPartAgent, 0) };
  }, [factures]);

  return <div className="space-y-6">
    <PageHeader title="Tableau de bord" description="Vue opérationnelle des factures, contrôles et retenues sur salaire." actions={<button type="button" className="btn-secondary" onClick={refresh} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : undefined} /> Actualiser</button>} />
    {error && <ErrorBlock message={error} onRetry={refresh} />}
    {factures === null ? loading ? <LoadingState message="Chargement des indicateurs…" /> : null : <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={ClipboardList} color="slate" value={String(dashboard.toProcess)} label="À traiter" note="Factures enregistrées" />
        <Kpi icon={Users} color="blue" value={String(dashboard.awaiting)} label="En validation" note="En attente de décision" />
        <Kpi icon={AlertTriangle} color="amber" value={String(dashboard.correction)} label="À corriger" note="Retour ou correction requis" />
        <Kpi icon={BadgeDollarSign} color="emerald" value={money.format(dashboard.cem)} label="Part CEM" note="Montant des factures affichées" />
        <Kpi icon={WalletCards} color="violet" value={totalPaie === null ? "—" : money.format(totalPaie)} label="Retenues clôturées" note={totalPaie === null ? "Données de paie indisponibles" : "Tous les mois de paie"} />
      </section>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="panel p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-extrabold text-slate-900">Circuit des factures</h2><p className="text-sm text-slate-500">Répartition des {dashboard.rows.length} factures actives et clôturées.</p></div><Link to="/factures" className="text-sm font-bold text-red-600 hover:text-red-700">Voir les factures <ArrowRight className="inline" size={15} /></Link></div><div className="space-y-4">{dashboard.statusCounts.map((item) => <div key={item.status}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold text-slate-700">{statusLabel[item.status] ?? item.status}</span><span className="font-bold text-slate-900">{item.count}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${(item.count / dashboard.max) * 100}%` }} /></div></div>)}</div><div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3"><Summary label="Validées / sorties" value={String(dashboard.validated)} /><Summary label="Charge agent" value={money.format(dashboard.agent)} /><Summary label="Dépassements" value={money.format(dashboard.rows.reduce((total, row) => total + row.depassement, 0))} /></div></div>
        <div className="panel overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-extrabold text-slate-900">À traiter en priorité</h2><p className="text-sm text-slate-500">Les factures ouvertes les plus anciennes.</p></div><div className="divide-y divide-slate-100">{dashboard.priorities.length === 0 ? <p className="p-5 text-sm text-slate-500">Aucune facture en attente.</p> : dashboard.priorities.map((facture) => <Link to="/factures" key={facture.id} className="block px-5 py-3 transition hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{facture.refSocial} · {facture.nomEtablissement}</p><p className="mt-1 text-xs text-slate-500">{money.format(facture.montantTotal)}{daysSince(facture.dateReception) !== null ? ` · depuis ${daysSince(facture.dateReception)} j` : ""}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${statusClass[facture.statut] ?? "bg-slate-100 text-slate-600"}`}>{statusLabel[facture.statut] ?? facture.statut}</span></div></Link>)}</div></div>
      </section>
      <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={18} /> Les indicateurs sont calculés à partir des factures et des états de paie actuellement disponibles.</div>
    </>}
  </div>;
}

function Kpi({ icon: Icon, color, value, label, note }: { icon: typeof ClipboardList; color: "slate" | "blue" | "amber" | "emerald" | "violet"; value: string; label: string; note: string }) { const colors = { slate: "bg-slate-100 text-slate-700", blue: "bg-blue-100 text-blue-700", amber: "bg-amber-100 text-amber-700", emerald: "bg-emerald-100 text-emerald-700", violet: "bg-violet-100 text-violet-700" }; return <div className="panel p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}><Icon size={19} /></div><p className="mt-4 truncate text-xl font-extrabold tracking-tight text-slate-900" title={value}>{value}</p><p className="mt-1 text-sm font-bold text-slate-700">{label}</p><p className="mt-1 text-xs text-slate-400">{note}</p></div>; }
function Summary({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-extrabold text-slate-800">{value}</p></div>; }
