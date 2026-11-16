import { API_BASE_URL, apiService } from "../../../services/api";
import { getKeycloakAccessToken } from "../../auth/services/keycloak";
import { io } from "socket.io-client";

export type DiscussionMessage = {
	id: number;
	contenu: string;
	createdAt: string;
	auteur: { id: number; nom: string };
};

export type DiscussionFacture = {
	factureGlobaleId: number;
	messages: DiscussionMessage[];
};

const route = (factureId: number) => `/factures/${factureId}/discussion`;

export const obtenirDiscussionFacture = (factureId: number) =>
	apiService.get<DiscussionFacture>(route(factureId));

export const envoyerMessageDiscussion = (factureId: number, contenu: string) =>
	apiService.post<DiscussionMessage>(`${route(factureId)}/messages`, { contenu });

/** Opens a live, authenticated subscription for one invoice discussion. */
export async function suivreDiscussionFacture(
	factureId: number,
	onMessage: (message: DiscussionMessage) => void,
	onError: (error: Error) => void,
): Promise<() => void> {
	const token = await getKeycloakAccessToken();
	const socket = io(`${API_BASE_URL.replace(/\/+$/, "")}/discussions`, {
		auth: { token },
		transports: ["websocket"],
	});
	socket.on("connect", () => socket.emit("discussion:rejoindre", { factureId }));
	socket.on("discussion:nouveau-message", onMessage);
	socket.on("connect_error", (cause: Error) => onError(cause));
	return () => socket.disconnect();
}
