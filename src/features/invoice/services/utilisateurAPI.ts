import type { UtilisateurPaths } from "../../../api/domains/utilisateur";
import { apiService } from "../../../services/api";
import {
	type QueryOf,
	type ResponseOf,
} from "../../../services/api-contract";

const ROUTE = "/utilisateurs" as const satisfies keyof UtilisateurPaths;

export type UtilisateurListQuery = QueryOf<UtilisateurPaths, typeof ROUTE, "get">;
export type UtilisateurListResponse = ResponseOf<UtilisateurPaths, typeof ROUTE, "get">;

export const getUtilisateurs = (
	query?: UtilisateurListQuery,
): Promise<UtilisateurListResponse> =>
	apiService.get<UtilisateurListResponse>(ROUTE, { params: query });
