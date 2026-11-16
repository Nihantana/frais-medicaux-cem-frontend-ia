import { apiService } from "../../../services/api";
import type { User } from "../../../types/auth";

export async function fetchMe(): Promise<User> {
  return apiService.get<User>("/auth/me");
}
