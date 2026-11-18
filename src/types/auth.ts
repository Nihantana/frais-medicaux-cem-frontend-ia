export type Role =
  | "ASSISTANT"
  | "CONTROLEUR"
  | "ADJOINT"
  | "CHEF_SERVICE"
  | "DRH"
  | "ADMINISTRATEUR"
  | "OPERATEUR"
  | "CHEF";

export interface User {
  id: number;
  nom: string;
  email: string;
  role: Role;
  roles: Role[];
  hasPhoto: boolean;
}
