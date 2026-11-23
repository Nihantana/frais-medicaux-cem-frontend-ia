import type { SuiviPaths } from "../api/domains/suivi";
import { apiService } from "./api";
import { type QueryOf, type ResponseOf } from "./api-contract";

const ROUTES = {
	cibles: "/suivis/cibles",
	feuille: "/suivis",
} as const satisfies Record<string, keyof SuiviPaths>;

export type SuiviCibleListQuery = NonNullable<
	QueryOf<SuiviPaths, typeof ROUTES.cibles, "get">
>;
export type SuiviCibleListResponse = ResponseOf<
	SuiviPaths,
	typeof ROUTES.cibles,
	"get"
>;
export type SuiviFeuilleQuery = NonNullable<
	QueryOf<SuiviPaths, typeof ROUTES.feuille, "get">
>;
export type SuiviFeuilleResponse = ResponseOf<
	SuiviPaths,
	typeof ROUTES.feuille,
	"get"
> & {
	entete: {
		idp: string;
		im: number | null;
		nomPrenomBeneficiaire: string;
		nomPrenomAgent: string | null;
		codeFam: "Agent" | "Conjoint" | "Enfant" | null;
		direction: string | null;
		serviceAgence: string | null;
		observationIdp: string | null;
	};
};

/**
 * `GET /suivis/cibles` — actes and categories whose ceilings are tracked.
 * Without `date`, the backend uses today (Indian/Antananarivo).
 */
export function listSuiviCibles(
	query?: SuiviCibleListQuery,
): Promise<SuiviCibleListResponse> {
	return apiService.get<SuiviCibleListResponse>(ROUTES.cibles, {
		params: query,
	});
}

/** `GET /suivis` — computed lines for one beneficiary and target. */
export function lireFeuilleSuivi(
	query: SuiviFeuilleQuery,
): Promise<SuiviFeuilleResponse> {
	return apiService.get<SuiviFeuilleResponse>(ROUTES.feuille, {
		params: query,
	});
}
