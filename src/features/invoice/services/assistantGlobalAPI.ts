import { apiService } from "../../../services/api";

export type ReponseAssistantGlobal = { reponse: string; sources: string[]; avertissement: string };

export const questionnerAssistantGlobal = (question: string) =>
	apiService.post<ReponseAssistantGlobal>("/assistant/question", { question });
