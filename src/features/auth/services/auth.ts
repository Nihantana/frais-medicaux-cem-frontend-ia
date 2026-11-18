import { api, apiService, imageFormData } from "../../../services/api";
import type { User } from "../../../types/auth";

export async function fetchMe(): Promise<User> {
  return apiService.get<User>("/auth/me");
}

export async function updateProfile(nom: string): Promise<User> {
  return apiService.patch<User>("/auth/me", { nom });
}

export async function uploadProfilePhoto(image: File): Promise<User> {
  return apiService.patch<User>(
    "/auth/me/photo",
    imageFormData({}, image),
  );
}

export async function fetchProfilePhoto(): Promise<Blob> {
  const response = await api.get<Blob>("/auth/me/photo", {
    responseType: "blob",
  });
  return response.data;
}
