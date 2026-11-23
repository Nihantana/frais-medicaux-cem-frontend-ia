import type { components } from "../../../api/schema";
import { apiService } from "../../../services/api";
import type { SuiviFeuilleResponse } from "../../../services/suivi-api";
import { getFactures } from "./serviceAPI";

type CreerLigneSuiviInput = Omit<
	components["schemas"]["CreerLigneSuiviDto"],
	"libelle"
> & {
	refSocial: string;
	libelle: string;
};

type ModifierLigneSuiviInput =
	components["schemas"]["ModifierLigneSuiviDto"];

export async function creerLigneT5(
	input: CreerLigneSuiviInput,
): Promise<SuiviFeuilleResponse> {
	const factures = await getFactures();
	const facture = factures.find(
		(candidate) => candidate.refSociale === input.refSocial,
	);
	if (!facture) {
		throw new Error(`La facture ${input.refSocial} est introuvable.`);
	}

	return apiService.post<SuiviFeuilleResponse>(
		`/factures/${facture.id}/suivis`,
		{
			idp: input.idp,
			acteId: input.acteId,
			dateActe: input.dateActe,
			libelle: input.libelle,
			montantActe: input.montantActe,
		},
	);
}

export function modifierLigneT5(
	ligneId: number,
	input: ModifierLigneSuiviInput,
): Promise<void> {
	return apiService.patch<void>(
		`/suivis/lignes/${ligneId}`,
		input,
	);
}
