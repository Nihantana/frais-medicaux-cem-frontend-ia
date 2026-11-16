import type { FactureGlobaleListeeResponseDto } from "../../../api/domains/facture";
import { formatDate } from "../../../utils/format";
import { mapFactureAttachment } from "./mapFactureAttachment";
import type { FactureGlobaleRow } from "../types/invoiceTable";

function toAmount(value: string | null, field: string, factureId: number): number {
	if (value === null) return 0;
	const amount = Number(value);
	if (!Number.isFinite(amount)) {
		throw new Error(`Le montant « ${field} » de la facture ${factureId} est invalide.`);
	}
	return amount;
}

function toMonth(value: string, factureId: number): Date {
	const month = new Date(value);
	if (Number.isNaN(month.getTime())) {
		throw new Error(`Le mois de prestation de la facture ${factureId} est invalide.`);
	}
	return month;
}

function toDisplayDate(value: string | null, field: string, factureId: number): string {
	if (!value) return "";
	const formatted = formatDate(value);
	if (formatted === "—") {
		throw new Error(`La date « ${field} » de la facture ${factureId} est invalide.`);
	}
	return formatted;
}

function dernierMouvementDeType(
	facture: FactureGlobaleListeeResponseDto,
	type: string,
) {
	return facture.mouvements
		.filter((mouvement) => mouvement.type === type)
		.reduce<typeof facture.mouvements[number] | null>(
			(dernier, mouvement) =>
				dernier === null || mouvement.id > dernier.id ? mouvement : dernier,
			null,
		);
}

function dernierMouvementDeTypes(
	facture: FactureGlobaleListeeResponseDto,
	types: readonly string[],
) {
	return facture.mouvements
		.filter((mouvement) => types.includes(mouvement.type))
		.reduce<typeof facture.mouvements[number] | null>(
			(dernier, mouvement) =>
				dernier === null || mouvement.id > dernier.id ? mouvement : dernier,
			null,
		);
}

export function mapFactureGlobaleResponse(
	facture: FactureGlobaleListeeResponseDto,
): FactureGlobaleRow {
	const enregistrement = dernierMouvementDeType(facture, "ENREGISTREMENT");
	const envoiValidation = dernierMouvementDeType(facture, "ENVOI_VALIDATION");
	const retourPrestataire = dernierMouvementDeType(facture, "RETOUR_PRESTATAIRE");
	const receptionApresModification = dernierMouvementDeType(facture, "RECEPTION_APRES_MODIFICATION");
	const retourCorrection = dernierMouvementDeType(facture, "RETOUR_POUR_CORRECTION");
	const dernierMouvementRemarque2 = dernierMouvementDeTypes(facture, [
		"ENVOI_VALIDATION",
		"RETOUR_POUR_CORRECTION",
	]);
	const validation = dernierMouvementDeType(facture, "VALIDATION");
	const sortie = dernierMouvementDeType(facture, "SORTIE");
	const montantTotal = toAmount(facture.montantTotal, "montant total", facture.id);
	const partCem100 = toAmount(facture.total100Cem, "total 100 % CEM", facture.id);
	const depassement = toAmount(facture.totalDepassement, "total dépassement", facture.id);

	return {
		id: facture.id,
		prestataireId: facture.prestataireId,
		piecesJointes: (facture.piecesJointes ?? []).map(mapFactureAttachment),
		statut: facture.statut,
		refSocial: facture.refSociale,
		dateReception: toDisplayDate(facture.dateReception, "date de réception", facture.id),
		numFacture: facture.numFacture,
		dateFacture: toDisplayDate(facture.dateFacture, "date de facture", facture.id),
		nomEtablissement: facture.prestataire.nom,
		montantTotal,
		partCem100,
		depassement,
		partCem80: toAmount(facture.montant80Cem, "montant 80 % CEM", facture.id),
		partAgent20: toAmount(facture.montant20Agent, "montant 20 % agent", facture.id),
		totalPartAgent: toAmount(facture.totalChargeAgent, "charge totale agent", facture.id),
		localite: "",
		moisPrestation: facture.moisPrestation ? toMonth(facture.moisPrestation, facture.id) : null,
		refAgence: facture.refAgence ?? "",
		remarques1: facture.remarque ?? "",
		retourPrestataire: retourPrestataire?.remarque ?? "",
		recuApresModification: toDisplayDate(
			receptionApresModification?.date ?? null,
			"date de réception après modification",
			facture.id,
		),
		dateEnregistrement: toDisplayDate(enregistrement?.date ?? facture.createdAt, "date d'enregistrement", facture.id),
		parQuiEnregistrement: enregistrement?.effectuePar.nom ?? "",
		dateEnvoiValidation: toDisplayDate(envoiValidation?.date ?? null, "date d'envoi pour validation", facture.id),
		pourQuiValidation: envoiValidation?.adresseA?.nom ?? "",
		remarques2: dernierMouvementRemarque2?.remarque ?? "",
		retourCorrection: retourCorrection?.remarque ?? "",
		dateValidation: toDisplayDate(validation?.date ?? facture.dateValidation, "date de validation", facture.id),
		parQuiValidationFinale: validation?.effectuePar.nom ?? "",
		dateSortie: toDisplayDate(sortie?.date ?? null, "date de sortie", facture.id),
		serviceSortie: sortie?.service ?? "",
	};
}

export function mapFacturesGlobalesResponse(
	factures: FactureGlobaleListeeResponseDto[],
): FactureGlobaleRow[] {
	return factures.map(mapFactureGlobaleResponse);
}
