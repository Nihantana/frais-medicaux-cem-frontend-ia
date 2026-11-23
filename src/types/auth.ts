export type Role =
  | "ASSISTANT"
  | "CONTROLEUR"
  | "ADJOINT"
  | "CHEF_SERVICE"
  | "DRH"
  | "ADMINISTRATEUR";

export interface User {
  id: number;
  nom: string;
  email: string;
  roles: Role[];
  hasPhoto: boolean;
}
