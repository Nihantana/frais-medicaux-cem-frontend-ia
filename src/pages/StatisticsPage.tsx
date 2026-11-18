import {
	Activity,
	ArrowDownRight,
	ArrowUpRight,
	BadgeDollarSign,
	Building2,
	CalendarDays,
	CheckCircle2,
	RefreshCw,
	ReceiptText,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorBlock, LoadingState, PageHeader } from "../components/ui";
import { getFactureLines, getFactures } from "../features/invoice/services/serviceAPI";
import { mapFacturesGlobalesResponse } from "../features/invoice/services/mapFactureGlobaleResponse";
import type { FactureGlobaleRow } from "../features/invoice/types/invoiceTable";
import { listActes } from "../services/acte-api";
import { listCategories } from "../services/categorie-acte-api";
import type { LigneFactureResponseDto } from "../api/domains/facture/components";

type PeriodPreset = "month" | "quarter" | "year";
type Ranking = { label: string; value: number; count: number };
type FactureLine = LigneFactureResponseDto & { factureId: number };

const money = new Intl.NumberFormat("fr-FR", {
	style: "currency",
	currency: "MGA",
	maximumFractionDigits: 0,
});
const compactMoney = new Intl.NumberFormat("fr-FR", {
	notation: "compact",
	maximumFractionDigits: 1,
});

function parseDisplayDate(value: string): Date | null {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
	if (!match) return null;
	return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

function invoiceDate(row: FactureGlobaleRow): Date | null {
	return row.moisPrestation ?? parseDisplayDate(row.dateReception);
}

function ranking(items: Array<{ label: string; amount: number; count?: number }>, limit = 5): Ranking[] {
	const totals = new Map<string, Ranking>();
	for (const item of items) {
		const current = totals.get(item.label) ?? { label: item.label, value: 0, count: 0 };
		current.value += item.amount;
		current.count += item.count ?? 1;
		totals.set(item.label, current);
	}
	return [...totals.values()].sort((a, b) => b.value - a.value).slice(0, limit);
}

function AnimatedNumber({
	value,
	format,
}: {
	value: number;
	format: "money" | "number";
}) {
	const [displayValue, setDisplayValue] = useState(0);
	const previousValue = useRef(0);

	useEffect(() => {
		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (prefersReducedMotion) {
			const frame = requestAnimationFrame(() => setDisplayValue(value));
			return () => cancelAnimationFrame(frame);
		}

		const from = previousValue.current;
		const start = performance.now();
		const duration = 650;
		let frameId = 0;
		const animate = (now: number) => {
			const progress = Math.min(1, (now - start) / duration);
			const eased = 1 - Math.pow(1 - progress, 3);
			setDisplayValue(from + (value - from) * eased);
			if (progress < 1) frameId = requestAnimationFrame(animate);
		};
		frameId = requestAnimationFrame(animate);
		previousValue.current = value;
		return () => cancelAnimationFrame(frameId);
	}, [value]);

	return (
		<>
			{format === "money"
				? money.format(displayValue)
				: new Intl.NumberFormat("fr-FR").format(Math.round(displayValue))}
		</>
	);
}

function MonthChart({ values }: { values: Array<{ label: string; value: number }> }) {
	const max = Math.max(1, ...values.map((item) => item.value));
	return (
		<div className="h-64 rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/70 to-white p-4">
			<div className="flex h-full items-end gap-2">
				{values.map((item, index) => (
					<div key={item.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
						<div className="group relative flex h-[calc(100%-1.75rem)] items-end">
							<div
								className="stats-bar w-full origin-bottom rounded-t-md bg-gradient-to-t from-blue-600 to-indigo-400"
								style={{
									height: `${Math.max(item.value > 0 ? 6 : 0, (item.value / max) * 100)}%`,
									animationDelay: `${index * 55}ms`,
								}}
							/>
							<div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white shadow-lg group-hover:block">
								{money.format(item.value)}
							</div>
						</div>
						<span className="mt-2 truncate text-center text-[10px] font-bold uppercase text-slate-400">
							{item.label.slice(0, 3)}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

function RankingCard({
	title,
	description,
	rows,
	valueLabel,
}: {
	title: string;
	description: string;
	rows: Ranking[];
	valueLabel?: "amount" | "count";
}) {
	const max = Math.max(1, ...rows.map((row) => row.value));
	return (
		<section className="stats-enter rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
			<h2 className="text-[15px] font-extrabold tracking-tight text-slate-900">{title}</h2>
			<p className="mt-1 text-[13px] leading-5 text-slate-500">{description}</p>
			<div className="mt-5 space-y-4">
				{rows.length === 0 ? (
					<p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">
						Aucune donnée disponible.
					</p>
				) : rows.map((row, index) => (
					<div key={row.label}>
						<div className="mb-2 flex items-center gap-3">
							<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-600">
								{index + 1}
							</span>
							<span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-slate-700" title={row.label}>
								{row.label}
							</span>
							<span className="shrink-0 text-sm font-extrabold text-slate-900">
								{valueLabel === "count" ? row.count : money.format(row.value)}
							</span>
						</div>
						<div className="ml-10 h-1.5 overflow-hidden rounded-full bg-slate-100">
							<div
								className="stats-bar-x h-full origin-left rounded-full bg-gradient-to-r from-blue-600 to-indigo-400"
								style={{
									width: `${(row.value / max) * 100}%`,
									animationDelay: `${index * 70}ms`,
								}}
							/>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function Kpi({
	icon: Icon,
	label,
	value,
	note,
	tone,
	format = "money",
	trend,
}: {
	icon: typeof ReceiptText;
	label: string;
	value: number;
	note: string;
	tone: "blue" | "emerald" | "violet" | "amber";
	format?: "money" | "number";
	trend?: number;
}) {
	const tones = {
		blue: "bg-blue-50 text-blue-700",
		emerald: "bg-emerald-50 text-emerald-700",
		violet: "bg-violet-50 text-violet-700",
		amber: "bg-amber-50 text-amber-700",
	};
	return (
		<section className="stats-enter rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
			<div className="flex items-start justify-between">
				<div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>
					<Icon size={20} />
				</div>
				{trend !== undefined && (
					<span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
						trend >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
					}`}>
						{trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
						{Math.abs(trend).toFixed(1)} %
					</span>
				)}
			</div>
			<p className="mt-5 text-[22px] font-extrabold tracking-tight text-slate-900" title={format === "money" ? money.format(value) : String(value)}>
				<AnimatedNumber value={value} format={format} />
			</p>
			<p className="mt-1 text-[13px] font-bold leading-5 text-slate-700">{label}</p>
			<p className="mt-1 text-xs leading-4 text-slate-400">{note}</p>
		</section>
	);
}

export default function StatisticsPage() {
	const [factures, setFactures] = useState<FactureGlobaleRow[]>([]);
	const [lines, setLines] = useState<FactureLine[]>([]);
	const [categoryNames, setCategoryNames] = useState<Map<number, string>>(new Map());
	const [actNames, setActNames] = useState<Map<number, string>>(new Map());
	const [actCategories, setActCategories] = useState<Map<number, number>>(new Map());
	const [preset, setPreset] = useState<PeriodPreset>("year");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	async function load() {
		setLoading(true);
		setError(null);
		try {
			const [factureResult, acteResult, categoryResult] = await Promise.allSettled([
				getFactures(),
				listActes(),
				listCategories({ avecPlafonds: true, inclureActes: false }),
			]);

			let loadedFactures: FactureGlobaleRow[] = [];
			if (factureResult.status === "fulfilled") {
				loadedFactures = mapFacturesGlobalesResponse(factureResult.value);
				setFactures(loadedFactures);
			} else {
				setFactures([]);
				throw factureResult.reason;
			}

			if (acteResult.status === "fulfilled") {
				setActNames(new Map(acteResult.value.map((acte) => [acte.id, acte.nomActe])));
				setActCategories(
					new Map(
						acteResult.value.map((acte) => [
							acte.id,
							acte.categorieActeId,
						]),
					),
				);
			}
			if (categoryResult.status === "fulfilled") {
				setCategoryNames(
					new Map(
						categoryResult.value.map((category) => [
							category.id,
							category.nomCategorie,
						]),
					),
				);
			}

			const lineResults = await Promise.allSettled(
				loadedFactures.map((facture) => getFactureLines(facture.id)),
			);
			const loadedLines = lineResults.flatMap((result, index) =>
				result.status === "fulfilled"
					? result.value.lignes.map((line) => ({
							...line,
							factureId: loadedFactures[index]?.id ?? 0,
						}))
					: [],
			);
			setLines(loadedLines);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Impossible de charger les statistiques.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		const timer = window.setTimeout(() => void load(), 0);
		return () => window.clearTimeout(timer);
	}, []);

	const statistics = useMemo(() => {
		const now = new Date();
		let start: Date;
		const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
		if (preset === "month") {
			start = new Date(now.getFullYear(), now.getMonth(), 1);
		} else if (preset === "quarter") {
			start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
		} else {
			start = new Date(now.getFullYear(), 0, 1);
		}

		const filteredFactures = factures.filter((row) => {
			const date = invoiceDate(row);
			return date !== null && date >= start && date <= end;
		});
		const factureIds = new Set(filteredFactures.map((row) => row.id));
		const filteredLines = lines.filter((line) => factureIds.has(line.factureId));

		const total = filteredFactures.reduce((sum, row) => sum + row.montantTotal, 0);
		const cem = filteredFactures.reduce(
			(sum, row) => sum + row.partCem100 + row.partCem80,
			0,
		);
		const agent = filteredFactures.reduce((sum, row) => sum + row.totalPartAgent, 0);
		const overage = filteredFactures.reduce((sum, row) => sum + row.depassement, 0);
		const validated = filteredFactures.filter(
			(row) => row.statut === "VALIDEE" || row.statut === "SORTIE",
		).length;
		const activeBeneficiaries = new Set(filteredLines.map((line) => line.idp).filter(Boolean));

		const providerRanking = ranking(
			filteredFactures.map((row) => ({
				label: row.nomEtablissement || "Non renseigné",
				amount: row.montantTotal,
				count: 1,
			})),
		);
		const actRanking = ranking(
			filteredLines.map((line) => ({
				label: actNames.get(line.acte.id) || line.libelle || line.acte.nom,
				amount: Number(line.montantActe),
				count: 1,
			})),
		);
		const categoryRanking = ranking(
			filteredLines.map((line) => {
				const categoryId = actCategories.get(line.acte.id);
				const category = categoryId === undefined
					? undefined
					: categoryNames.get(categoryId);
				return {
					label: category || line.categorieAgent || "Autres catégories",
					amount: Number(line.montantActe),
					count: 1,
				};
			}),
		);
		const serviceRanking = ranking(
			filteredLines.map((line) => ({
				label: line.codeDirection || line.categorieAgent || "Non renseigné",
				amount: Number(line.montantActe),
				count: 1,
			})),
		);

		const monthCount = preset === "month" ? 1 : preset === "quarter" ? 3 : 12;
		const monthValues = Array.from({ length: monthCount }, (_, index) => {
			const monthDate = preset === "month"
				? new Date(now.getFullYear(), now.getMonth(), 1)
				: preset === "quarter"
					? new Date(now.getFullYear(), now.getMonth() - monthCount + 1 + index, 1)
					: new Date(now.getFullYear(), index, 1);
			const month = monthDate.getMonth();
			const year = monthDate.getFullYear();
			const value = filteredFactures
				.filter((row) => {
					const date = invoiceDate(row);
					return date !== null && date.getMonth() === month && date.getFullYear() === year;
				})
				.reduce((sum, row) => sum + row.montantTotal, 0);
			return {
				label: monthDate.toLocaleDateString("fr-FR", { month: "short" }),
				value,
			};
		});

		return {
			total,
			cem,
			agent,
			overage,
			validated,
			activeBeneficiaries: activeBeneficiaries.size,
			invoices: filteredFactures.length,
			providerRanking,
			actRanking,
			categoryRanking,
			serviceRanking,
			monthValues,
		};
	}, [factures, lines, preset, actNames, categoryNames, actCategories]);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Statistiques"
				description="Analyse des dépenses, de l’utilisation des prestations et de l’activité des factures."
				actions={
					<button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
						<RefreshCw size={16} className={loading ? "animate-spin" : undefined} />
						Actualiser
					</button>
				}
			/>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
					{([
						["month", "Ce mois"],
						["quarter", "3 derniers mois"],
						["year", "Cette année"],
					] as const).map(([value, label]) => (
						<button
							key={value}
							type="button"
							className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
								preset === value
									? "bg-slate-900 text-white shadow-sm"
									: "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
							}`}
							onClick={() => setPreset(value)}
						>
							{label}
						</button>
					))}
				</div>
				<div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
					<CalendarDays size={16} className="text-blue-600" />
					<span className="font-bold">{statistics.invoices}</span> factures analysées
				</div>
			</div>

			{error && <ErrorBlock message={error} onRetry={() => void load()} />}
			{loading ? (
				<LoadingState message="Calcul des statistiques…" />
			) : (
				<>
					<section key={`kpis-${preset}`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
						<Kpi
							icon={BadgeDollarSign}
							label="Dépenses totales"
							value={statistics.total}
							note="Montant des factures"
							tone="blue"
						/>
						<Kpi
							icon={Building2}
							label="Part CEM"
							value={statistics.cem}
							note="Prise en charge CEM"
							tone="emerald"
						/>
						<Kpi
							icon={Users}
							label="Part bénéficiaires"
							value={statistics.agent}
							note="Charge totale des bénéficiaires"
							tone="violet"
						/>
						<Kpi
							icon={Activity}
							label="Dépassements"
							value={statistics.overage}
							note="Montants dépassés"
							tone="amber"
						/>
						<Kpi
							icon={CheckCircle2}
							label="Factures validées"
							value={statistics.validated}
							format="number"
							note={`${statistics.activeBeneficiaries} bénéficiaires actifs`}
							tone="emerald"
						/>
					</section>

					<section key={`charts-${preset}`} className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
						<div className="stats-enter rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
							<div className="mb-5 flex items-start justify-between">
								<div>
									<h2 className="font-extrabold text-slate-900">Évolution des dépenses</h2>
									<p className="mt-1 text-sm text-slate-500">Montant mensuel des factures.</p>
								</div>
								<span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
									{compactMoney.format(statistics.total)}
								</span>
							</div>
							<MonthChart values={statistics.monthValues} />
						</div>
						<RankingCard
							title="Prestataires"
							description="Classement par montant facturé."
							rows={statistics.providerRanking}
						/>
					</section>

					<section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
						<RankingCard
							title="Actes les plus utilisés"
							description="Classement par montant consommé."
							rows={statistics.actRanking}
						/>
						<RankingCard
							title="Catégories les plus actives"
							description="Dépenses regroupées par catégorie."
							rows={statistics.categoryRanking}
						/>
						<RankingCard
							title="Services les plus dépensiers"
							description="Classement selon les lignes de prestation."
							rows={statistics.serviceRanking}
						/>
					</section>
				</>
			)}
		</div>
	);
}
