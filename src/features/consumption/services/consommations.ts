import { apiService } from "../../../services/api";

export type TypeConsommationT6 = "MEDICAMENT" | "LUNETTES" | "AUTRE";

export interface MedicamentSelection {
  nom: string;
  sourceId?: string;
  source?: "BDPM" | "RXNORM";
  substanceActive?: string;
}

export interface LunettesSelection {
  typeVerre?: string;
  monture?: string;
  sphereOD?: number;
  cylindreOD?: number;
  axeOD?: number;
  sphereOG?: number;
  cylindreOG?: number;
  axeOG?: number;
}

export type ConsommationT6Input =
  | {
      type: "MEDICAMENT";
      quantite: number;
      posologie?: string;
      medicament: MedicamentSelection;
    }
  | { type: "LUNETTES"; lunettes: LunettesSelection }
  | { type: "AUTRE"; description: string };

export interface ConsommationT6Detail {
  type: TypeConsommationT6;
  quantite: string | null;
  posologie: string | null;
  medicament: {
    id: number;
    nom: string;
    sourceId: string | null;
    rxcui: string | null;
    substanceActive: string | null;
    source: string;
    statut: string;
  } | null;
  lunettes: {
    typeVerre: string | null;
    monture: string | null;
    sphereOD: string | null;
    cylindreOD: string | null;
    axeOD: number | null;
    sphereOG: string | null;
    cylindreOG: string | null;
    axeOG: number | null;
  } | null;
  description: string | null;
}

export interface MedicamentSuggestion {
  sourceId: string | null;
  source: string;
  nom: string;
  substanceActive: string | null;
}

export interface RechercheMedicamentsResultat {
  suggestions: MedicamentSuggestion[];
  avertissement: string | null;
}

export interface BeneficiaireT6Validation {
  idp: string;
  nomPrenomBeneficiaire: string;
}

export interface ConsommationT6Item {
  ligneId: number;
  dateActe: string;
  refSociale: string;
  numFacture: string;
  idp: string;
  nomPrenomBeneficiaire: string;
  type: TypeConsommationT6;
  libelle: string;
  montantActe: string;
  quantite: string | null;
  posologie: string | null;
  medicament: {
    nom: string;
    sourceId: string | null;
    rxcui: string | null;
    substanceActive: string | null;
    source: string;
    statut: string;
  } | null;
  lunettes: ConsommationT6Detail["lunettes"];
  description: string | null;
}

export interface ConsommationT6Filters {
  type?: TypeConsommationT6;
  idp?: string;
  du?: string;
  au?: string;
  page?: number;
  limit?: number;
}

export interface ConsommationT6ListResponse {
  elements: ConsommationT6Item[];
  total: number;
  page: number;
  limit: number;
}

export const rechercherMedicaments = (
  terme: string,
): Promise<RechercheMedicamentsResultat> =>
  apiService.get<RechercheMedicamentsResultat>(
    "/consommations-t6/medicaments",
    { params: { terme } },
  );

export const verifierBeneficiaireT6 = (
  idp: string,
): Promise<BeneficiaireT6Validation> =>
  apiService.get<BeneficiaireT6Validation>(
    `/consommations-t6/beneficiaires/${encodeURIComponent(idp)}`,
  );

export const listerConsommations = (
  params: ConsommationT6Filters = {},
): Promise<ConsommationT6ListResponse> =>
  apiService.get<ConsommationT6ListResponse>("/consommations-t6", { params });
