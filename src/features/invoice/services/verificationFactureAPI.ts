import { apiService } from "../../../services/api";

export type ControleFactureResultat = {
	code: string;
	statut: string;
	gravite: string;
	valeurAttendue: string | null;
	valeurTrouvee: string | null;
	preuve: string | null;
	confiance: number | null;
	confirme: boolean;
};

export type ControleFactureRapport = {
	id: number;
	factureGlobaleId: number;
	statut: string;
	score: number | null;
	extraction: {
		destinataire: string | null;
		montantChiffres: number | null;
		montantLettres: string | null;
		montantLettresValeur: number | null;
		prestataire: string | null;
		beneficiaire: string | null;
		numeroFacture: string | null;
		dateFacture: string | null;
		actes: string[];
	} | null;
	resultats: ControleFactureResultat[];
	createdAt: string;
	updatedAt: string;
	confirmeParId: number | null;
	confirmeLe: string | null;
};

export type ReponseAssistantFacture = {
	reponse: string;
	sources: string[];
	avertissement: string;
};

const route = (factureId: number) => `/factures/${factureId}/controle-visuel`;

export const lancerControleFacture = (factureId: number) =>
	apiService.post<ControleFactureRapport>(route(factureId));

export const obtenirControleFacture = (factureId: number) =>
	apiService.get<ControleFactureRapport>(route(factureId));

export const questionnerAssistantFacture = (factureId: number, question: string) =>
	apiService.post<ReponseAssistantFacture>(`${route(factureId)}/assistant`, { question });
