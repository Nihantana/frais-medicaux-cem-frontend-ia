import { apiService } from "../../../services/api";

export type UserRole = string;

export interface ManagedUser {
  id: number;
  nom: string;
  email: string | null;
  roles: UserRole[];
}

export interface EffectivePermission {
  id: number;
  code: string;
  libelle: string;
  autorisee: boolean;
  personnalisee: boolean;
}

export interface ManagedRole {
  id: number;
  code: string;
  libelle: string;
  systeme: boolean;
}

interface UserResponse {
  utilisateur: ManagedUser;
}

export function listUsers(): Promise<ManagedUser[]> {
  return apiService.get<ManagedUser[]>("/utilisateurs");
}

export function createUser(input: {
  nom: string;
  email: string;
  roles: UserRole[];
}): Promise<UserResponse> {
  return apiService.post<UserResponse>("/utilisateurs", input);
}

export function updateUser(
  id: number,
  input: Partial<Pick<ManagedUser, "nom" | "email" | "roles">>,
): Promise<UserResponse> {
  return apiService.patch<UserResponse>(`/utilisateurs/${id}`, input);
}

export function deleteUser(id: number): Promise<void> {
  return apiService.delete<void>(`/utilisateurs/${id}`);
}

export function getUserPermissions(id: number): Promise<EffectivePermission[]> {
  return apiService.get<EffectivePermission[]>(
    `/utilisateurs/${id}/permissions`,
  );
}

export function setUserPermission(
  userId: number,
  code: string,
  autorisee: boolean,
): Promise<void> {
  return apiService.put<void>(
    `/utilisateurs/${userId}/permissions/${encodeURIComponent(code)}`,
    { autorisee },
  );
}

export function resetUserPermission(
  userId: number,
  code: string,
): Promise<void> {
  return apiService.delete<void>(
    `/utilisateurs/${userId}/permissions/${encodeURIComponent(code)}`,
  );
}

export function listRoles(): Promise<ManagedRole[]> {
  return apiService.get<ManagedRole[]>("/utilisateurs/roles/catalogue");
}

export function createRole(input: {
  code: string;
  libelle: string;
}): Promise<ManagedRole> {
  return apiService.post<ManagedRole>("/utilisateurs/roles", input);
}

export function updateRole(
  id: number,
  input: { libelle: string },
): Promise<ManagedRole> {
  return apiService.patch<ManagedRole>(`/utilisateurs/roles/${id}`, input);
}

export function deleteRole(id: number): Promise<void> {
  return apiService.delete<void>(`/utilisateurs/roles/${id}`);
}

export function getRolePermissions(
  id: number,
): Promise<EffectivePermission[]> {
  return apiService.get<EffectivePermission[]>(
    `/utilisateurs/roles/${id}/permissions`,
  );
}

export function setRolePermission(
  roleId: number,
  code: string,
  autorisee: boolean,
): Promise<void> {
  return apiService.put<void>(
    `/utilisateurs/roles/${roleId}/permissions/${encodeURIComponent(code)}`,
    { autorisee },
  );
}

export function resetRolePermission(roleId: number, code: string): Promise<void> {
  return apiService.delete<void>(
    `/utilisateurs/roles/${roleId}/permissions/${encodeURIComponent(code)}`,
  );
}
