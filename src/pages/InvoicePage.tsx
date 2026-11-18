
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Sparkles, X } from "lucide-react";
import { FactureGlobaleTable } from "../features/invoice";
import { AddRowButton, CancelRowButton, ConfirmDialog, ErrorBlock, LoadingState, PageHeader, SaveRowButton, ToastViewport } from "../components/ui";
import InvoiceFloatingCalculator from "../features/invoice/components/ui/InvoiceFloatingCalculator";
import useFactureGlobaleRows from "../features/invoice/hooks/useFactureGlobaleRows";
import usePrestataires from "../features/invoice/hooks/usePrestataires";
import useSuiviCibles from "../features/invoice/hooks/useSuiviCibles";
import useFactureGlobaleRowActions from "../features/invoice/hooks/useFactureGlobaleRowActions";
import useInvoiceRowEditing from "../features/invoice/hooks/useInvoiceRowEditing";
import useScrollToAddInvoiceRow from "../features/invoice/hooks/useScrollToAddInvoiceRow";
import { getUtilisateurs } from "../features/invoice/services/utilisateurAPI";
import { useAuth } from "../features/auth";
import ControleFactureIAPanel from "../features/invoice/components/ui/ControleFactureIAPanel";
import DiscussionFacturePanel from "../features/invoice/components/ui/DiscussionFacturePanel";
import useControleFactureIA from "../features/invoice/hooks/useControleFactureIA";
import { getFactureTransitions } from "../features/invoice/services/serviceAPI";
import type { FactureWorkflowBody } from "../features/invoice/services/serviceAPI";
import type { TransitionFactureResponseDto } from "../api/domains/facture";

type ConfirmableRowAction = "requestValidation" | "reviewValidate" | "reviewReject" | "sortie" | "dynamic";

const rowActionConfirmation: Record<ConfirmableRowAction, { title: string; confirmLabel: string; message: string }> = {
	requestValidation: {
		title: "Confirmer l’envoi",
		confirmLabel: "Envoyer",
		message: "Voulez-vous vraiment envoyer cette demande de validation ?",
	},
	reviewValidate: {
		title: "Confirmer la validation",
		confirmLabel: "Valider",
		message: "Voulez-vous vraiment valider cette facture ?",
	},
	reviewReject: {
		title: "Confirmer le rejet",
		confirmLabel: "Rejeter",
		message: "Voulez-vous vraiment rejeter cette facture et demander une correction ?",
	},
	sortie: {
		title: "Confirmer la sortie",
		confirmLabel: "Confirmer",
		message: "Voulez-vous vraiment confirmer la sortie de cette facture ?",
	},
	dynamic: {
		title: "Confirmer l’action",
		confirmLabel: "Exécuter",
		message: "Voulez-vous exécuter cette action sur la facture ?",
	},
};

export default function FactureGlobalePage() {
	const [isSaveConfirmationOpen, setIsSaveConfirmationOpen] = useState(false);
	const [confirmableRowAction, setConfirmableRowAction] = useState<ConfirmableRowAction | null>(null);
	const [openRowAction, setOpenRowAction] = useState<"validate" | "review" | "sortie" | "actions" | null>(null);
	const [availableTransitions, setAvailableTransitions] = useState<TransitionFactureResponseDto[]>([]);
	const [selectedTransition, setSelectedTransition] = useState<TransitionFactureResponseDto["type"] | "">("");
	const [actionRemark, setActionRemark] = useState("");
	const [validationDate, setValidationDate] = useState("");
	const [validationDestinataireId, setValidationDestinataireId] = useState("");
	const [reviewAction, setReviewAction] = useState<"correct" | null>(null);
	const [correctionComment, setCorrectionComment] = useState("");
	const [sortieDate, setSortieDate] = useState("");
	const [serviceSortie, setServiceSortie] = useState("");
	const [rowActionError, setRowActionError] = useState<string | null>(null);
	const [supportPanel, setSupportPanel] = useState<"assistant" | "discussion" | null>(null);
	const { role } = useAuth();
	const canEditRows = role !== "CHEF";
	const [destinataires, setDestinataires] = useState<Array<{ id: number; nom: string; roles: string[] }>>([]);
	const [destinatairesError, setDestinatairesError] = useState<string | null>(null);
	const { prestataires, error: prestatairesError, reload: reloadPrestataires } = usePrestataires();
	const { options: majT5Options, error: majT5Error, reload: reloadMajT5Options } = useSuiviCibles();
	const { rows, addRowId, selectedRowId, selectRow, isLoaded, loadError, reload, updateCell, addAttachment, removeAttachment, downloadAttachment, refreshRows, restoreRow } = useFactureGlobaleRows(prestataires);
	const rowActions = useFactureGlobaleRowActions(rows, reload);
	const rowEditing = useInvoiceRowEditing(rows, addRowId, updateCell, restoreRow, refreshRows, canEditRows);
	const { containerRef, addRowRef, isAddRowVisible, focusAddRow } = useScrollToAddInvoiceRow(isLoaded);
	const activeRow = useMemo(
		() => rows.find((row) => row.id === selectedRowId) ?? null,
		[rows, selectedRowId],
	);
	const canActOnSelectedRow = selectedRowId !== null && activeRow !== null && !rowEditing.hasActiveRow;
	const controleIA = useControleFactureIA(activeRow?.id ?? null);

	useEffect(() => {
		if (!canEditRows) return;
		void Promise.all([getUtilisateurs({ role: "ADJOINT" }), getUtilisateurs({ role: "CHEF" })])
			.then(([adjoints, chefs]) => {
				setDestinataires([...adjoints, ...chefs]);
				setDestinatairesError(null);
			})
			.catch((error: unknown) => {
				setDestinatairesError(error instanceof Error ? error.message : "Impossible de charger les destinataires.");
			});
	}, [canEditRows]);

	function resetValidationForm() {
		setValidationDate("");
		setValidationDestinataireId("");
	}

	function resetReviewForm() {
		setCorrectionComment("");
	}

	function resetSortieForm() {
		setSortieDate("");
		setServiceSortie("");
	}

	async function applyValidationToRow() {
		if (!activeRow || !(await rowActions.requestValidation(activeRow.id, validationDate, Number(validationDestinataireId)))) return;
		resetValidationForm();
		setOpenRowAction(null);
	}

	async function applyReviewDecision() {
		if (!activeRow || reviewAction !== "correct" || !(await rowActions.rejectReviewedInvoice(activeRow.id, correctionComment))) return;
		resetReviewForm();
		setReviewAction(null);
		setOpenRowAction(null);
	}

	async function validateReviewedRow() {
		if (!activeRow || !(await rowActions.validateReviewedInvoice(activeRow.id))) return;
		setOpenRowAction(null);
	}

	function resetDynamicActionForm() {
		setAvailableTransitions([]);
		setSelectedTransition("");
		setActionRemark("");
		resetValidationForm();
		resetSortieForm();
	}

	async function executeSelectedAction() {
		if (!activeRow || !selectedTransition) return;
		const body: Record<string, unknown> = { type: selectedTransition };
		if (actionSupportsDate && validationDate) body.date = validationDate;
		if ((selectedRequiredFields.has("remarque") || selectedTransition === "VALIDATION" || selectedTransition === "REFUS_SUPPRESSION" || selectedTransition === "SUPPRESSION") && actionRemark.trim()) body.remarque = actionRemark.trim();
		if (selectedRequiredFields.has("destinataireId") && validationDestinataireId) body.destinataireId = Number(validationDestinataireId);
		if (selectedRequiredFields.has("service") && serviceSortie) body.service = serviceSortie;
		await rowActions.executeAction(activeRow.id, body as FactureWorkflowBody);
		resetDynamicActionForm();
		setOpenRowAction(null);
	}

	async function applySortieDecision() {
		if (!activeRow || !(await rowActions.registerInvoiceExit(activeRow.id, sortieDate, serviceSortie))) return;
		resetSortieForm();
		setOpenRowAction(null);
	}

	function closeRowAction() {
		setOpenRowAction(null);
		setReviewAction(null);
		setRowActionError(null);
		resetValidationForm();
		resetReviewForm();
		resetSortieForm();
	}

	async function confirmRowAction() {
		if (!confirmableRowAction) return;
		try {
			switch (confirmableRowAction) {
				case "requestValidation":
					await applyValidationToRow();
					break;
				case "reviewValidate":
					await validateReviewedRow();
					break;
				case "reviewReject":
					await applyReviewDecision();
					break;
				case "sortie":
					await applySortieDecision();
					break;
				case "dynamic":
					await executeSelectedAction();
					break;
			}
			setRowActionError(null);
		} catch (error: unknown) {
			setRowActionError(error instanceof Error ? error.message : "L’action n’a pas pu être exécutée.");
			return;
		}
		setConfirmableRowAction(null);
	}

	const selectedTransitionDetails = availableTransitions.find(
		(transition) => transition.type === selectedTransition,
	);
	const selectedRequiredFields = new Set(selectedTransitionDetails?.champsRequis ?? []);
	const actionSupportsDate = selectedTransition === "ENVOI_VALIDATION"
		|| selectedTransition === "RETOUR_POUR_CORRECTION"
		|| selectedTransition === "RETOUR_PRESTATAIRE"
		|| selectedTransition === "SORTIE";
	const actionLabel = (type: string) => ({
		ENVOI_VALIDATION: "Envoyer en validation",
		RETOUR_POUR_CORRECTION: "Retourner pour correction",
		RETOUR_PRESTATAIRE: "Retourner au prestataire",
		VALIDATION: "Valider",
		SORTIE: "Enregistrer la sortie",
		DEMANDE_SUPPRESSION: "Demander la suppression",
		REFUS_SUPPRESSION: "Refuser la suppression",
		SUPPRESSION: "Confirmer la suppression",
	}[type] ?? type.replaceAll("_", " "));

	return (
		<>
			<ToastViewport />
			<ConfirmDialog
				open={confirmableRowAction !== null}
				title={confirmableRowAction ? rowActionConfirmation[confirmableRowAction].title : "Confirmation"}
				confirmLabel={confirmableRowAction ? rowActionConfirmation[confirmableRowAction].confirmLabel : "Confirmer"}
				variant="primary"
				message={confirmableRowAction ? rowActionConfirmation[confirmableRowAction].message : ""}
				onCancel={() => setConfirmableRowAction(null)}
				onConfirm={confirmRowAction}
			/>
			<ConfirmDialog
				open={isSaveConfirmationOpen}
				title="Confirmer l’enregistrement"
				confirmLabel="Enregistrer"
				confirmDisabled={rowEditing.isSaving}
				variant="primary"
				message="Voulez-vous vraiment enregistrer les modifications?"
				onCancel={() => setIsSaveConfirmationOpen(false)}
				onConfirm={async () => {
					const saved = await rowEditing.saveActiveRow();
					if (saved) setIsSaveConfirmationOpen(false);
				}}
			/>
			<div className="flex h-[calc(100dvh-13rem)] min-h-[24rem] flex-col lg:h-[calc(100dvh-14rem)]">
				<PageHeader
					title="Factures globales"
					description={canEditRows
						? "Suivi des factures, des montants pris en charge et de leur circuit de validation. Cliquez sur une cellule autorisée pour la modifier."
						: "Consultation des factures et de leur circuit de validation. Les données sont en lecture seule."}
				/>
				{rowActionError && (
					<p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
						{rowActionError}
					</p>
				)}
				{rowEditing.saveError && (
					<p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
						{rowEditing.saveError}
					</p>
				)}
				<section className="panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
						<div className="min-w-0 text-xs text-slate-500">
							{activeRow ? <>Facture sélectionnée : <span className="font-bold text-slate-700">{activeRow.refSocial}</span></> : "Sélectionnez une facture pour utiliser les outils de suivi."}
						</div>
						<div className="flex items-center gap-2">
							<button type="button" className="btn-secondary min-h-9 px-3 py-1.5 text-xs" onClick={() => setSupportPanel("discussion")} disabled={!activeRow}>
								<MessageSquare size={15} /> Discussion
							</button>
							<button type="button" className="btn-secondary min-h-9 px-3 py-1.5 text-xs" onClick={() => setSupportPanel("assistant")} disabled={!activeRow}>
								<Sparkles size={15} /> Contrôle IA
							</button>
						</div>
					</div>
					{prestatairesError && (
						<div className="p-3 pb-0">
							<ErrorBlock
								message={prestatairesError}
								onRetry={() => void reloadPrestataires()}
							/>
						</div>
					)}
					{majT5Error && (
						<div className="p-3 pb-0">
							<ErrorBlock
								message={majT5Error}
								onRetry={() => void reloadMajT5Options()}
							/>
						</div>
					)}
					{loadError ? (
						<ErrorBlock
							message={loadError}
							onRetry={async () => {
								if (await reload()) rowEditing.clearSaveError();
							}}
						/>
					) : isLoaded ? (
						<FactureGlobaleTable
							rows={rows}
							prestataires={prestataires}
							majT5Options={majT5Options}
							addRowId={addRowId}
							activeRowId={rowEditing.activeRowId}
							selectedRowId={selectedRowId}
							isAddRowVisible={isAddRowVisible}
							containerRef={containerRef}
							addRowRef={addRowRef}
							onRowSelect={(rowId) => {
								if (rowEditing.hasActiveRow && rowEditing.activeRowId !== rowId) return;
								selectRow(rowId);
							}}
							onCellChange={rowEditing.onCellChange}
							onAddAttachment={addAttachment}
							onRemoveAttachment={removeAttachment}
							onDownloadAttachment={downloadAttachment}
							onOpenActions={(rowId) => {
								selectRow(rowId);
								setReviewAction(null);
								setOpenRowAction("actions");
								setRowActionError(null);
								setAvailableTransitions([]);
								setSelectedTransition("");
								void getFactureTransitions(rowId)
									.then((transitions) => {
										setAvailableTransitions(transitions);
										setSelectedTransition(transitions[0]?.type ?? "");
									})
									.catch((error: unknown) => setRowActionError(error instanceof Error ? error.message : "Impossible de charger les actions disponibles."));
							}}
						/>
					) : (
						<LoadingState message="Chargement des données…" />
					)}
				</section>
			</div>
			{supportPanel && (
				<div className="fixed inset-0 z-40 bg-slate-950/25" onClick={() => setSupportPanel(null)}>
					<aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-slate-50 shadow-2xl" onClick={(event) => event.stopPropagation()} aria-label={supportPanel === "assistant" ? "Contrôle IA" : "Discussion de la facture"}>
						<div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
							<div><h2 className="font-extrabold text-slate-900">{supportPanel === "assistant" ? "Contrôle IA" : "Discussion"}</h2><p className="text-xs text-slate-500">{activeRow ? `Facture ${activeRow.refSocial}` : "Aucune facture sélectionnée"}</p></div>
							<button type="button" className="btn-ghost" aria-label="Fermer le panneau" onClick={() => setSupportPanel(null)}><X size={20} /></button>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto p-4">
							{supportPanel === "assistant" ? <ControleFactureIAPanel key={activeRow?.id ?? "none"} factureId={activeRow?.id ?? null} rapport={controleIA.rapport} isLoading={controleIA.isLoading} error={controleIA.error} onRun={() => void controleIA.run()} disabled={!canActOnSelectedRow} /> : <DiscussionFacturePanel factureId={activeRow?.id ?? null} />}
						</div>
					</aside>
				</div>
			)}
			{isLoaded && <>
				{canEditRows && (
					<div className="fixed bottom-6 right-6 z-30 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur sm:gap-1.5">
						<CancelRowButton
							showLabel
							label="Annuler"
							ariaLabel="Annuler les modifications de la ligne active"
							title="Annuler les modifications de la ligne active"
							disabled={!rowEditing.hasActiveRow || rowEditing.isSaving}
							onClick={rowEditing.cancelActiveRow}
						/>
						<SaveRowButton
							showLabel
							label="Enregistrer"
							ariaLabel="Enregistrer la ligne active"
							title="Enregistrer la ligne active"
							disabled={!rowEditing.canSave || rowEditing.isSaving}
							onClick={() => setIsSaveConfirmationOpen(true)}
						/>
						<span className="mx-1 h-7 w-px bg-slate-200" aria-hidden="true" />
						<AddRowButton
							showLabel
							label="Nouvelle facture"
							ariaLabel="Ajouter une nouvelle facture"
							title="Ajouter une nouvelle facture"
							disabled={rowEditing.hasActiveRow}
							onClick={focusAddRow}
						/>
						<span className="mx-1 h-7 w-px bg-slate-200" aria-hidden="true" />
						<InvoiceFloatingCalculator showLabel />
					</div>
				)}
				{canActOnSelectedRow && openRowAction === "actions" && (
					<div className="fixed bottom-28 right-8 z-40 w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
						<button type="button" aria-label="Fermer" className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={closeRowAction}><X size={18} /></button>
						<h3 className="mb-3 pr-8 text-sm font-bold text-slate-900">Choisir une action</h3>
						{availableTransitions.length === 0 ? (
							<p className="text-sm text-slate-500">Aucune action disponible pour cette facture.</p>
						) : (
							<div className="space-y-3">
								<label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
									Action
									<select value={selectedTransition} onChange={(event) => setSelectedTransition(event.target.value as typeof selectedTransition)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
									{availableTransitions.map((transition) => <option key={transition.type} value={transition.type}>{actionLabel(transition.type)}</option>)}
									</select>
								</label>
								{actionSupportsDate && <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Date<input type="date" value={validationDate} onChange={(event) => setValidationDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>}
								{selectedRequiredFields.has("destinataireId") && <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Destinataire<select value={validationDestinataireId} onChange={(event) => setValidationDestinataireId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={destinataires.length === 0}><option value="">Sélectionner</option>{destinataires.map((destinataire) => <option key={destinataire.id} value={destinataire.id}>{destinataire.nom} ({destinataire.roles.join(", ")})</option>)}</select></label>}
								{(selectedRequiredFields.has("remarque") || selectedTransition === "VALIDATION" || selectedTransition === "REFUS_SUPPRESSION" || selectedTransition === "SUPPRESSION") && <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Remarque<textarea value={actionRemark} onChange={(event) => setActionRemark(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>}
								{selectedRequiredFields.has("service") && <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Service<select value={serviceSortie} onChange={(event) => setServiceSortie(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Sélectionner</option><option value="AUTHENTIFICATION">Authentification</option><option value="CONTROLE">Contrôle</option></select></label>}
								<div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={closeRowAction}>Annuler</button><button type="button" className="btn-primary" onClick={() => setConfirmableRowAction("dynamic")} disabled={selectedRequiredFields.has("destinataireId") && !validationDestinataireId || selectedRequiredFields.has("remarque") && !actionRemark.trim() || selectedRequiredFields.has("service") && !serviceSortie}>Exécuter</button></div>
							</div>
						)}
					</div>
				)}
				{canEditRows && canActOnSelectedRow && openRowAction === "validate" && (
					<div className="fixed bottom-28 right-8 z-40 w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
						<button type="button" aria-label="Fermer" className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={closeRowAction}><X size={18} /></button>
						<h3 className="mb-3 pr-8 text-sm font-bold text-slate-900">Demande de validation</h3>
						<div className="space-y-3">
							<label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
								Date de la demande
								<input type="date" value={validationDate} onChange={(event) => setValidationDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
							</label>
							<label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
								Destinataire
								<select value={validationDestinataireId} onChange={(event) => setValidationDestinataireId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" disabled={destinataires.length === 0}>
									<option value="">Sélectionner</option>
									{destinataires.map((destinataire) => (
										<option key={destinataire.id} value={destinataire.id}>{destinataire.nom} ({destinataire.roles.join(", ")})</option>
									))}
								</select>
							</label>
							{destinatairesError && <p role="alert" className="text-xs text-red-600">{destinatairesError}</p>}
						</div>
						<div className="mt-4 flex justify-end gap-2">
							<button type="button" className="btn-secondary" onClick={resetValidationForm}>Réinitialiser</button>
							<button type="button" className="btn-primary" onClick={() => setConfirmableRowAction("requestValidation")} disabled={!validationDate || !validationDestinataireId}>OK</button>
						</div>
					</div>
				)}
				{!canEditRows && canActOnSelectedRow && openRowAction === "review" && reviewAction === "correct" && (
					<div className="fixed bottom-28 right-8 z-40 w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
						<button type="button" aria-label="Fermer" className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={closeRowAction}><X size={18} /></button>
						<h3 className="mb-3 pr-8 text-sm font-bold text-slate-900">Rejeter la ligne</h3>
						<label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
							Remarques
							<textarea value={correctionComment} onChange={(event) => setCorrectionComment(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Décrivez la correction demandée…" />
						</label>
						<div className="mt-4 flex justify-end gap-2">
							<button type="button" className="btn-secondary" onClick={resetReviewForm}>Réinitialiser</button>
							<button type="button" className="btn-primary" onClick={() => setConfirmableRowAction("reviewReject")} disabled={!correctionComment.trim()}>OK</button>
						</div>
					</div>
				)}
				{!canEditRows && canActOnSelectedRow && openRowAction === "review" && !reviewAction && (
					<div className="fixed bottom-28 right-8 z-40 w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
						<button type="button" aria-label="Fermer" className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={closeRowAction}><X size={18} /></button>
						<h3 className="mb-3 pr-8 text-sm font-bold text-slate-900">Choisir une action</h3>
						<div className="flex gap-2">
							<button type="button" className="btn-primary flex-1" onClick={() => setConfirmableRowAction("reviewValidate")}>Valider</button>
							<button type="button" className="btn-secondary flex-1" onClick={() => setReviewAction("correct")}>Rejeter</button>
						</div>
					</div>
				)}
				{!canEditRows && canActOnSelectedRow && openRowAction === "sortie" && (
					<div className="fixed bottom-28 right-8 z-40 w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
						<button type="button" aria-label="Fermer" className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={closeRowAction}><X size={18} /></button>
						<h3 className="mb-3 pr-8 text-sm font-bold text-slate-900">Sortie</h3>
						<div className="space-y-3">
							<label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
								Date de sortie
								<input type="date" value={sortieDate} onChange={(event) => setSortieDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
							</label>
							<label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
								Service de sortie
								<select value={serviceSortie} onChange={(event) => setServiceSortie(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
									<option value="">Sélectionner</option>
									<option value="AUTHENTIFICATION">Authentification</option>
									<option value="CONTROLE">Contrôle</option>
								</select>
							</label>
						</div>
						<div className="mt-4 flex justify-end gap-2">
							<button type="button" className="btn-secondary" onClick={resetSortieForm}>Réinitialiser</button>
							<button type="button" className="btn-primary" onClick={() => setConfirmableRowAction("sortie")} disabled={!sortieDate || !serviceSortie.trim()}>OK</button>
						</div>
					</div>
				)}
			</>}
		</>
	);
}
