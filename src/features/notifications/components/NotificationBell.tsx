import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import {
	countUnreadNotifications,
	getNotifications,
	markAllNotificationsRead,
	markNotificationRead,
	type AppNotification,
} from "../services/notifications";

function formatDate(value: string): string {
	return new Intl.DateTimeFormat("fr-FR", {
		dateStyle: "short",
		timeStyle: "short",
	}).format(new Date(value));
}

export default function NotificationBell() {
	const [open, setOpen] = useState(false);
	const [count, setCount] = useState(0);
	const [items, setItems] = useState<AppNotification[]>([]);

	useEffect(() => {
		let actif = true;
		const actualiser = async () => {
			try {
				const [resultat, notifications] = await Promise.all([
					countUnreadNotifications(),
					open ? getNotifications(true) : Promise.resolve(null),
				]);
				if (!actif) return;
				setCount(resultat.count);
				if (notifications !== null) setItems(notifications);
			} catch {
				// Les notifications ne doivent pas bloquer l'application principale.
			}
		};
		void actualiser();
		const intervalle = window.setInterval(() => void actualiser(), 10000);
		return () => {
			actif = false;
			window.clearInterval(intervalle);
		};
	}, [open]);

	async function basculer(): Promise<void> {
		const prochainEtat = !open;
		setOpen(prochainEtat);
		if (!prochainEtat) return;
		try {
			setItems(await getNotifications(true));
		} catch {
			setItems([]);
		}
	}

	async function lire(notification: AppNotification): Promise<void> {
		if (!notification.luLe) {
			await markNotificationRead(notification.id);
			setCount((valeur) => Math.max(0, valeur - 1));
			setItems((courantes) => courantes.filter((item) => item.id !== notification.id));
		}
	}

	async function toutLire(): Promise<void> {
		await markAllNotificationsRead();
		setItems([]);
		setCount(0);
	}

	return (
		<div className="relative">
			<button
				className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100"
				onClick={() => void basculer()}
				aria-label="Notifications"
			>
				<Bell size={19} />
				{count > 0 && (
					<span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold text-white">
						{count > 99 ? "99+" : count}
					</span>
				)}
			</button>
			{open && (
				<div className="absolute right-0 top-12 z-50 w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
					<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
						<div className="font-bold text-slate-900">Notifications</div>
						<button className="text-xs font-semibold text-red-600" onClick={() => void toutLire()}>
							<CheckCheck size={15} className="mr-1 inline" />Tout lire
						</button>
					</div>
					<div className="max-h-96 overflow-y-auto">
						{items.length === 0 ? (
							<div className="px-4 py-8 text-center text-sm text-slate-500">Aucune notification non lue.</div>
						) : items.map((notification) => (
							<button
								key={notification.id}
								className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
								onClick={() => void lire(notification)}
							>
								<div className="text-sm font-bold text-slate-900">{notification.titre}</div>
								<div className="mt-1 text-xs text-slate-600">{notification.message}</div>
								<div className="mt-2 text-[10px] text-slate-400">{formatDate(notification.createdAt)}</div>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
