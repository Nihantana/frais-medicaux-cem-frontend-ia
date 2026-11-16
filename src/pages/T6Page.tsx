import { useEffect, useMemo, useState, type FormEvent } from "react";
import { LockKeyhole, Plus, RefreshCw, X } from "lucide-react";
import { DataTable, type Column } from "../components/ui/DataTable";
import { ErrorBlock, LoadingState, Modal, PageHeader } from "../components/ui";
import { listActes } from "../services/acte-api";
import { cloturerFacture, getPaieMois } from "../features/invoice/services/paieAPI";
import {
	createFactureLine,
	deleteFactureLine,
	getFactureLines,
	getFactures,
	updateFactureLine,
	type CreateFactureLineBody,
	type FactureLinesResponse,
	type FactureListResponse,
	type UpdateFactureLineBody,
} from "../features/invoice/services/serviceAPI";
import type { components } from "../api/schema";

type Facture = FactureListResponse[number];
type Acte = components["schemas"]["ActeResponseDto"];
type Ligne = FactureLinesResponse["lignes"][number];

type Draft = {
	libelle: string;
	dateActe: string;
	idp: string;
	acteId: string;
	numPec: string;
	refPaie: string;
	montantActe: string;
	montantDepassementActe: string;
	montantDepassementPlafond: string;
	observationDepassement: string;
	moisAffectation: string;
};

const emptyDraft = (): Draft => ({
	libelle: "",
	dateActe: new Date().toISOString().slice(0, 10),
	idp: "",
	acteId: "",
	numPec: "",
	refPaie: "",
	montantActe: "",
	montantDepassementActe: "0",
	montantDepassementPlafond: "0",
	observationDepassement: "",
	moisAffectation: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
});

const money = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (value: string | number | null | undefined): string => value === null || value === undefined || value === "" ? "—" : money.format(Number(value));
const dateOnly = (value: string): string => value.slice(0, 10);
const incrementMonth = (value: string): string => {
	const [year, month] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year, month, 1));
	return date.toISOString().slice(0, 7);
};

export default function T6Page() {
	const [factures, setFactures] = useState<Facture[]>([]);
	const [actes, setActes] = useState<Acte[]>([]);
	const [selectedFactureId, setSelectedFactureId] = useState("");
	const [refSocialeQuery, setRefSocialeQuery] = useState("");
	const [linesResponse, setLinesResponse] = useState<FactureLinesResponse | null>(null);
	const [draft, setDraft] = useState<Draft>(emptyDraft);
	const [editingLineId, setEditingLineId] = useState<number | null>(null);
	const [lineFormOpen, setLineFormOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [clotureMois, setClotureMois] = useState(new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 7));

	const selectedFacture = useMemo(() => factures.find((facture) => String(facture.id) === selectedFactureId) ?? null, [factures, selectedFactureId]);
	const factureSuggestions = useMemo(() => {
		const query = refSocialeQuery.trim().toLocaleLowerCase();
		if (!query || selectedFactureId) return [];
		return factures.filter((facture) => facture.refSociale.toLocaleLowerCase().includes(query)).slice(0, 8);
	}, [factures, refSocialeQuery, selectedFactureId]);
	const acteFromLibelle = actes.find((acte) => acte.nomActe.trim().toLocaleLowerCase() === draft.libelle.trim().toLocaleLowerCase());
	const selectedActe = actes.find((acte) => String(acte.id) === draft.acteId) ?? acteFromLibelle;

	async function loadFacturesAndActes() {
		setIsLoading(true); setError(null);
		try {
			const [facturesResult, actesResult, paiesResult] = await Promise.all([getFactures(), listActes(), getPaieMois()]);
			setFactures(facturesResult); setActes(actesResult);
			if (paiesResult[0]) setClotureMois(incrementMonth(paiesResult[0].moisPaie));
			if (facturesResult[0]) setSelectedFactureId((current) => current || String(facturesResult[0].id));
		} catch (caught: unknown) {
			setError(caught instanceof Error ? caught.message : "Impossible de charger les données T6.");
		} finally { setIsLoading(false); }
	}

	async function loadLines(factureId: number) {
		setError(null);
		try { setLinesResponse(await getFactureLines(factureId)); }
		catch (caught: unknown) {
			setError(caught instanceof Error ? caught.message : "Impossible de charger les lignes.");
			setLinesResponse(null);
		}
	}

	useEffect(() => { void loadFacturesAndActes(); }, []);
	useEffect(() => {
		if (!selectedFactureId) return;
		const timer = window.setTimeout(() => void loadLines(Number(selectedFactureId)), 0);
		return () => window.clearTimeout(timer);
	}, [selectedFactureId]);
	useEffect(() => {
		const mois = linesResponse?.lignes[0]?.moisAffectation?.slice(0, 7);
		if (mois) setClotureMois(mois);
	}, [linesResponse]);

	function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
	function openNewLine() { setEditingLineId(null); setDraft(emptyDraft()); setLineFormOpen(true); }
	function startEditing(line: Ligne) {
		setEditingLineId(line.id);
		setDraft({ libelle: line.libelle, dateActe: dateOnly(line.dateActe), idp: line.idp, acteId: String(line.acte.id), numPec: line.numPec ? String(line.numPec) : "", refPaie: line.refPaie ?? "", montantActe: line.montantActe, montantDepassementActe: line.montantDepassementActe, montantDepassementPlafond: line.montantDepassementPlafond, observationDepassement: line.observationDepassement ?? "", moisAffectation: line.moisAffectation ? dateOnly(line.moisAffectation) : emptyDraft().moisAffectation });
		setLineFormOpen(true);
	}
	function cancelEditing() { setEditingLineId(null); setDraft(emptyDraft()); setLineFormOpen(false); }
	function clearFactureSelection() { setSelectedFactureId(""); setLinesResponse(null); cancelEditing(); }
	function selectFacture(facture: Facture) { setRefSocialeQuery(facture.refSociale); setSelectedFactureId(String(facture.id)); setError(null); cancelEditing(); }

	function buildLineBody(): CreateFactureLineBody | UpdateFactureLineBody {
		return { libelle: draft.libelle.trim(), dateActe: draft.dateActe, idp: draft.idp.trim(), acteId: Number(draft.acteId || acteFromLibelle?.id), montantActe: Number(draft.montantActe), montantDepassementActe: Number(draft.montantDepassementActe || 0), montantDepassementPlafond: Number(draft.montantDepassementPlafond || 0), ...(draft.numPec ? { numPec: Number(draft.numPec) } : {}), refPaie: draft.refPaie.trim() || null, moisAffectation: `${draft.moisAffectation.slice(0, 7)}-01`, ...(draft.observationDepassement.trim() ? { observationDepassement: draft.observationDepassement.trim() } : {}) } as CreateFactureLineBody;
	}
	async function closeFacture() {
		if (!selectedFacture || !window.confirm("Clôturer définitivement cette facture ?")) return;
		const mois = window.prompt("Mois prévu de retenue (AAAA-MM)", clotureMois);
		if (!mois || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) { setError("Le mois de retenue doit être au format AAAA-MM."); return; }
		setClotureMois(mois);
		setIsSaving(true); setError(null);
		try { await cloturerFacture(selectedFacture.id, mois, new Date().toISOString().slice(0, 10)); await loadFacturesAndActes(); await loadLines(selectedFacture.id); }
		catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "La clôture a échoué."); }
		finally { setIsSaving(false); }
	}
	function validateDraft(): string | null {
		if (!selectedFactureId) return "Sélectionnez une facture globale.";
		if (!draft.libelle.trim() || !draft.idp.trim() || !draft.dateActe || (!draft.acteId && !acteFromLibelle)) return "Libellé, date, IDP et acte sont obligatoires. Le libellé doit correspondre à un acte existant.";
		if (!Number.isFinite(Number(draft.montantActe)) || Number(draft.montantActe) < 0) return "Le montant de l’acte doit être un nombre positif ou nul.";
		return null;
	}
	async function saveLine(event: FormEvent<HTMLFormElement>) {
		event.preventDefault(); const validationError = validateDraft();
		if (validationError) { setError(validationError); return; }
		setIsSaving(true); setError(null);
		try {
			const body = buildLineBody();
			if (editingLineId === null) await createFactureLine(Number(selectedFactureId), body as CreateFactureLineBody);
			else await updateFactureLine(Number(selectedFactureId), editingLineId, body as UpdateFactureLineBody);
			cancelEditing(); await loadLines(Number(selectedFactureId)); await loadFacturesAndActes();
		} catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "La ligne n’a pas pu être enregistrée."); }
		finally { setIsSaving(false); }
	}
	async function removeLine(lineId: number) {
		if (!window.confirm("Supprimer cette ligne de facture ?")) return;
		try { await deleteFactureLine(Number(selectedFactureId), lineId); if (editingLineId === lineId) cancelEditing(); await loadLines(Number(selectedFactureId)); await loadFacturesAndActes(); }
		catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "La ligne n’a pas pu être supprimée."); }
	}

	const fieldsDisabled = selectedFacture === null || isSaving;
	const columns: Column<Ligne>[] = [
		{ key: "moisAffectation", label: "Mois d’affectation", className: "min-w-[145px]", render: (line) => line.moisAffectation ? dateOnly(line.moisAffectation) : "—" },
		{ key: "refPaie", label: "Ref paie", className: "min-w-[150px]", render: (line) => line.refPaie ?? "—" },
		{ key: "dateSaisie", label: "Date saisie", className: "min-w-[120px]", render: (line) => dateOnly(line.dateSaisie) },
		{ key: "refSociale", label: "Ref social", className: "min-w-[120px]", render: () => selectedFacture?.refSociale ?? "—" },
		{ key: "numFacture", label: "Num facture", className: "min-w-[145px]", render: () => selectedFacture?.numFacture ?? "—" },
		{ key: "dateFacture", label: "Date facture", className: "min-w-[120px]", render: () => selectedFacture ? dateOnly(selectedFacture.dateFacture) : "—" },
		{ key: "prestataire", label: "Nom de l’établissement", className: "min-w-[220px] max-w-[260px]", wrap: true, render: () => selectedFacture?.prestataire.nom ?? "—" },
		{ key: "idp", label: "IDP", className: "min-w-[110px]", render: (line) => line.idp },
		{ key: "beneficiaire", label: "Nom et prénom bénéficiaire", className: "min-w-[220px]", render: (line) => line.nomPrenomBeneficiaire },
		{ key: "codeFam", label: "Code fam", className: "min-w-[95px]", render: (line) => line.codeFam ?? "—" },
		{ key: "obsIdp", label: "Obs IDP", className: "min-w-[130px]", render: (line) => line.obsIdp ?? "—" },
		{ key: "im", label: "IM", className: "min-w-[90px]", render: (line) => line.im ?? "—" },
		{ key: "agent", label: "Nom et prénom agent", className: "min-w-[220px]", render: (line) => line.nomPrenomAgent ?? "—" },
		{ key: "direction", label: "Code direction", className: "min-w-[120px]", render: (line) => line.codeDirection ?? "—" },
		{ key: "service", label: "Code service / agence", className: "min-w-[160px]", render: () => "—" },
		{ key: "acte", label: "Code acte", className: "min-w-[110px]", render: (line) => line.acte.code },
		{ key: "libelle", label: "Acte / prestation", className: "min-w-[220px] max-w-[280px]", wrap: true, render: (line) => line.libelle },
		{ key: "categorieAgent", label: "Catégorie agent", className: "min-w-[180px]", render: (line) => line.categorieAgent ?? "—" },
		{ key: "dateActe", label: "Date de l’acte", className: "min-w-[120px]", render: (line) => dateOnly(line.dateActe) },
		{ key: "numPec", label: "Num PEC", className: "min-w-[100px]", render: (line) => line.numPec ?? "—" },
		{ key: "montantActe", label: "Montant acte", className: "min-w-[135px] text-right", render: (line) => formatMoney(line.montantActe) },
		{ key: "montantCemIntegral", label: "100% CEM", className: "min-w-[135px] text-right", render: (line) => formatMoney(line.montantCemIntegral) },
		{ key: "montantDepassement", label: "Dépassement", className: "min-w-[135px] text-right", render: (line) => formatMoney(line.montantDepassement) },
		{ key: "observationDepassement", label: "Obs dépassement", className: "min-w-[180px] max-w-[240px]", wrap: true, render: (line) => line.observationDepassement ?? "—" },
		{ key: "montantCem", label: "80% CEM", className: "min-w-[135px] text-right", render: (line) => formatMoney(line.montantCem) },
		{ key: "montantAgent", label: "20% Agent", className: "min-w-[135px] text-right", render: (line) => formatMoney(line.montantAgent) },
		{ key: "totalChargeAgent", label: "Total à la charge de l’agent", className: "min-w-[170px] text-right", render: (line) => formatMoney(line.totalChargeAgent) },
	];

	return <div className="space-y-5">
		<PageHeader title="T6 — Facture individuelle" description="Saisie et consultation des lignes individuelles dans le format du tableau Excel T6." />
		{error && <ErrorBlock message={error} onRetry={() => void loadFacturesAndActes()} />}
		{isLoading ? <LoadingState message="Chargement des factures et des actes…" /> : <>
			<section className="panel grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
				<div className="relative"><label className="label" htmlFor="ref-sociale-search">Référence sociale de la facture globale</label><div className="flex gap-2"><input id="ref-sociale-search" className="field mt-1" placeholder="Ex. F26/002" value={refSocialeQuery} onChange={(event) => { setRefSocialeQuery(event.target.value); if (selectedFactureId) clearFactureSelection(); }} autoComplete="off" />{selectedFacture && <button type="button" className="btn-secondary mt-1" onClick={clearFactureSelection}>Modifier</button>}</div>{factureSuggestions.length > 0 && <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">{factureSuggestions.map((facture) => <button key={facture.id} type="button" className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-red-50" onClick={() => selectFacture(facture)}><span className="font-bold text-slate-900">{facture.refSociale}</span><span className="ml-2 text-slate-500">{facture.numFacture} — {facture.prestataire.nom}</span></button>)}</div>}{refSocialeQuery.trim() && !selectedFactureId && factureSuggestions.length === 0 && <p className="mt-2 text-xs text-slate-500">Aucune facture trouvée pour cette référence sociale.</p>}</div>
				{selectedFacture ? <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><div className="font-bold text-slate-900">{selectedFacture.prestataire.nom}</div><div>Statut : {selectedFacture.statut}</div><button type="button" className="btn-primary mt-2" onClick={() => void closeFacture()} disabled={fieldsDisabled || Boolean(selectedFacture.dateCloture)}><LockKeyhole size={16} /> {selectedFacture.dateCloture ? "Facture clôturée" : "Clôturer définitivement"}</button></div> : <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Cliquez sur une suggestion pour afficher la facture.</div>}
			</section>
			<section className="mt-4 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-extrabold text-slate-900">Lignes T6</h2><div className="flex gap-2"><button type="button" className="btn-primary" onClick={openNewLine} disabled={fieldsDisabled}><Plus size={17} /> Ajouter une ligne</button><button type="button" className="btn-secondary" title="Actualiser" onClick={() => selectedFactureId && void loadLines(Number(selectedFactureId))}><RefreshCw size={17} /> Actualiser</button></div></div><DataTable rows={linesResponse?.lignes ?? []} columns={columns} empty="Aucune ligne pour cette facture." onEdit={startEditing} onDelete={(line) => void removeLine(line.id)} pageSize={10} />{linesResponse && <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 sm:grid-cols-4"><span>Total actes : {formatMoney(linesResponse.totaux.montantActe)}</span><span>Total 100% CEM : {formatMoney(linesResponse.totaux.montantCemIntegral)}</span><span>Total 80% CEM : {formatMoney(linesResponse.totaux.montantCem)}</span><span>Total charge agent : {formatMoney(linesResponse.totaux.totalChargeAgent)}</span></div>}</section>
			<Modal open={lineFormOpen} title={editingLineId === null ? "Ajouter une ligne T6" : "Modifier la ligne T6"} description={selectedFacture ? `Facture ${selectedFacture.refSociale} — ${selectedFacture.prestataire.nom}` : undefined} onClose={cancelEditing} width="max-w-3xl"><form className="space-y-4" onSubmit={saveLine}><div className="grid gap-3 md:grid-cols-2"><label className="label">N° IDP<input className="field mt-1" value={draft.idp} onChange={(event) => updateDraft("idp", event.target.value)} disabled={fieldsDisabled} /></label><label className="label">Date acte<input type="date" className="field mt-1" value={draft.dateActe} onChange={(event) => updateDraft("dateActe", event.target.value)} disabled={fieldsDisabled} /></label><label className="label">Acte<select className="field mt-1" value={draft.acteId} onChange={(event) => { const acte = actes.find((item) => String(item.id) === event.target.value); updateDraft("acteId", event.target.value); if (acte && !draft.libelle) updateDraft("libelle", acte.nomActe); }} disabled={fieldsDisabled}><option value="">Sélectionner</option>{actes.map((acte) => <option key={acte.id} value={acte.id}>{acte.code} — {acte.nomActe}</option>)}</select></label><label className="label">N° PEC<input type="number" min="1" className="field mt-1" value={draft.numPec} onChange={(event) => updateDraft("numPec", event.target.value)} disabled={fieldsDisabled} /></label><label className="label">Ref paie (saisie manuelle)<input className="field mt-1" value={draft.refPaie} onChange={(event) => updateDraft("refPaie", event.target.value)} disabled={fieldsDisabled} /></label><label className="label md:col-span-2">Libellé<input className="field mt-1" value={draft.libelle} onChange={(event) => updateDraft("libelle", event.target.value)} disabled={fieldsDisabled} /></label><label className="label">Montant acte<input type="number" min="0" step="0.01" className="field mt-1" value={draft.montantActe} onChange={(event) => updateDraft("montantActe", event.target.value)} disabled={fieldsDisabled} /></label><label className="label">Dépassement acte<input type="number" min="0" step="0.01" className="field mt-1" value={draft.montantDepassementActe} onChange={(event) => updateDraft("montantDepassementActe", event.target.value)} disabled={fieldsDisabled} /></label><label className="label">Dépassement plafond<input type="number" min="0" step="0.01" className="field mt-1" value={draft.montantDepassementPlafond} onChange={(event) => updateDraft("montantDepassementPlafond", event.target.value)} disabled={fieldsDisabled} /></label><label className="label md:col-span-2">Observation<textarea className="field mt-1" rows={2} value={draft.observationDepassement} onChange={(event) => updateDraft("observationDepassement", event.target.value)} disabled={fieldsDisabled} /></label></div><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" className="btn-secondary" onClick={cancelEditing}><X size={16} /> Annuler</button><button type="submit" className="btn-primary" disabled={fieldsDisabled || !selectedActe}>{editingLineId === null ? "Ajouter la ligne" : "Enregistrer"}</button></div></form></Modal>
		</>}
	</div>;
}
