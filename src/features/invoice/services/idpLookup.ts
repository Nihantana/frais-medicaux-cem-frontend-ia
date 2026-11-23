import type { IdpLookupResult } from "../../../types/LookUp";
import type { SuiviFeuilleResponse } from "../../../services/suivi-api";
import { lireFeuilleSuivi } from "../../../services/suivi-api";
import type { T5ParAnRow } from "../types/t5ParAn";
import type { T5ParAnParActeRow } from "../types/t5ParAnParActe";
import type { T5ParSeanceRow } from "../types/t5ParSeance";

export type IdpLookupTarget = {
	id: number;
	type: "acte" | "categorie";
};

function toAmount(value: string | null | undefined): number {
	const amount = Number(value ?? 0);
	return Number.isFinite(amount) ? amount : 0;
}

function commonRow(
	line: SuiviFeuilleResponse["lignes"][number],
) {
	return {
		id: line.id,
		refSocial: line.refSociale,
		dateActe: line.dateActe,
		libelle: line.libelle,
		montantActe: toAmount(line.montantActe),
		nomEtablissement: line.nomEtablissement,
	};
}

function mapParAn(
	response: SuiviFeuilleResponse,
): T5ParAnRow[] {
	return response.lignes.map((line) => ({
		...commonRow(line),
		montantCumule: toAmount(line.cumulActeConsomme),
		soldePlafond: toAmount(line.soldePlafond),
		montantDepassement: toAmount(line.totalDepassement),
	}));
}

function mapParAnParActe(
	response: SuiviFeuilleResponse,
): T5ParAnParActeRow[] {
	return response.lignes.map((line) => ({
		...commonRow(line),
		depassementActe: toAmount(line.depassementActe),
		cumulActeConsomme: toAmount(line.cumulActeConsomme),
		soldePlafond: toAmount(line.soldePlafond),
		depassementPlafond: toAmount(line.depassementPlafond),
		totalDepassement: toAmount(line.totalDepassement),
	}));
}

function mapParSeance(
	response: SuiviFeuilleResponse,
): T5ParSeanceRow[] {
	return response.lignes.map((line) => ({
		...commonRow(line),
		numeroSeance:
			line.libelleSeance ??
			(line.numeroSeance === null ? "" : String(line.numeroSeance)),
		montantDepassement: toAmount(line.totalDepassement),
	}));
}

function mapT5Data(response: SuiviFeuilleResponse): IdpLookupResult["t5Data"] {
	return {
		parAn: response.modele === "PLAFOND_ANNUEL" ? mapParAn(response) : [],
		parAnParActe:
			response.modele === "PLAFOND_ACTE_ET_ANNUEL"
				? mapParAnParActe(response)
				: [],
		parSeance: response.modele === "SEANCES" ? mapParSeance(response) : [],
	};
}

export async function fetchIdpLookup(
	idp: string,
	target: IdpLookupTarget,
	annee?: number,
): Promise<IdpLookupResult> {
	if (!Number.isSafeInteger(target.id) || target.id <= 0) {
		throw new Error("La cible de suivi est invalide.");
	}

	const suivi = await lireFeuilleSuivi({
		idp,
		...(target.type === "acte"
			? { acteId: target.id }
			: { categorieActeId: target.id }),
		...(annee === undefined ? {} : { annee: String(annee) }),
	});

	return {
		beneficiary: {
			idp: suivi.entete.idp,
			nomPrenom: suivi.entete.nomPrenomBeneficiaire,
			codeFam: suivi.entete.codeFam ?? "",
			observationIdp: suivi.entete.observationIdp,
		},
		agent: {
			nomPrenom: suivi.entete.nomPrenomAgent,
			matricule:
				suivi.entete.im === null ? null : String(suivi.entete.im),
			direction: suivi.entete.direction,
			agenceService: suivi.entete.serviceAgence,
		},
		t5Data: mapT5Data(suivi),
	};
}
