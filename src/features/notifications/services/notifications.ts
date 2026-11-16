import { apiService } from "../../../services/api";

export type AppNotification = {
	id: number;
	factureGlobaleId: number;
	mouvementId: number;
	portee: "INDIVIDUELLE" | "GLOBALE";
	type: string;
	titre: string;
	message: string;
	luLe: string | null;
	createdAt: string;
	facture: { refSociale: string; statut: string };
};

export function getNotifications(nonLues = false): Promise<AppNotification[]> {
	return apiService.get<AppNotification[]>(
		`/notifications${nonLues ? "?nonLues=true" : ""}`,
	);
}

export function countUnreadNotifications(): Promise<{ count: number }> {
	return apiService.get<{ count: number }>("/notifications/non-lues/count");
}

export function markNotificationRead(id: number): Promise<void> {
	return apiService.patch<void>(`/notifications/${id}/lue`);
}

export function markAllNotificationsRead(): Promise<void> {
	return apiService.patch<void>("/notifications/lues");
}
