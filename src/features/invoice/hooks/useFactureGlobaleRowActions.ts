import { useCallback } from "react";
import type { FactureGlobaleRow } from "../types/invoiceTable";
import { updateFactureStatut } from "../services/serviceAPI";

export default function useFactureGlobaleRowActions(
	rows: FactureGlobaleRow[],
	reload: () => Promise<boolean>,
) {
	const runAction = useCallback(async (
		rowId: number,
		body: Parameters<typeof updateFactureStatut>[1],
	) => {
		if (!Number.isInteger(rowId) || !rows.some((row) => row.id === rowId)) return false;
		await updateFactureStatut(rowId, body);
		return reload();
	}, [reload, rows]);

	const hasRow = useCallback((rowId: number) => {
		return Number.isInteger(rowId) && rows.some((row) => row.id === rowId);
	}, [rows]);

	const requestValidation = useCallback(async (
		rowId: number,
		validationDate: string,
		destinataireId: number,
	) => {
		if (!hasRow(rowId) || !validationDate || !Number.isInteger(destinataireId)) return false;
		return runAction(rowId, {
			type: "ENVOI_VALIDATION",
			date: validationDate,
			destinataireId,
		});
	}, [hasRow, runAction]);

	const validateReviewedInvoice = useCallback((rowId: number) => {
		if (!hasRow(rowId)) return Promise.resolve(false);
		return runAction(rowId, { type: "VALIDATION" });
	}, [hasRow, runAction]);

	const rejectReviewedInvoice = useCallback((rowId: number, correctionComment: string) => {
		const comment = correctionComment.trim();
		if (!hasRow(rowId) || !comment) return Promise.resolve(false);
		return runAction(rowId, { type: "RETOUR_POUR_CORRECTION", remarque: comment });
	}, [hasRow, runAction]);

	const registerInvoiceExit = useCallback(async (
		rowId: number,
		sortieDate: string,
		serviceSortie: string,
	) => {
		if (!hasRow(rowId)) return false;
		const serviceValue = serviceSortie.trim();
		if (!sortieDate || (serviceValue !== "AUTHENTIFICATION" && serviceValue !== "CONTROLE")) return false;
		const service = serviceValue === "AUTHENTIFICATION" ? "AUTHENTIFICATION" : "CONTROLE";
		return runAction(rowId, { type: "SORTIE", date: sortieDate, service });
	}, [hasRow, runAction]);

	return {
		executeAction: runAction,
		requestValidation,
		validateReviewedInvoice,
		rejectReviewedInvoice,
		registerInvoiceExit,
	};
}
