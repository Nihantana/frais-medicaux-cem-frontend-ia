import { apiService } from '../../../services/api';

export type PaieMois = {
  moisPaie: string;
  nombreFactures: number;
  nombreLignes: number;
  totalAgent: string;
};

export type PaieEtat = {
  agents: Array<{
    im: number;
    nomPrenom: string;
    direction: string | null;
    serviceAgence: string | null;
    montantActe: string;
    cem100: string;
    depassement: string;
    cem80: string;
    agent20: string;
    totalAgent: string;
  }>;
  total: {
    montantActe: string;
    cem100: string;
    depassement: string;
    cem80: string;
    agent20: string;
    totalAgent: string;
  };
};

export type PaieEtatIndividuel = {
  im: number;
  nomPrenom: string;
  groupes: Array<{
    nomEtablissement: string;
    nombreLignes: number;
    totalEtablissement: PaieEtat['total'];
    lignes: Array<Record<string, string | number | null>>;
  }>;
  totalGeneral: PaieEtat['total'];
};

export const getPaieMois = (): Promise<PaieMois[]> => apiService.get('/paies');
export const getPaieEtat = (mois: string): Promise<PaieEtat> => apiService.get(`/paies/${mois}/etat`);
export const getPaieEtatIndividuel = (mois: string, im: number): Promise<PaieEtatIndividuel> =>
  apiService.get(`/paies/${mois}/agents/${im}`);

export const cloturerFacture = (id: number, moisAffectation: string, dateCloture: string) =>
  apiService.post(`/factures/${id}/cloture`, { moisAffectation, dateCloture });
