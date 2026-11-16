import { LoaderCircle, MessageSquare, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
	envoyerMessageDiscussion,
	obtenirDiscussionFacture,
	suivreDiscussionFacture,
	type DiscussionMessage,
} from "../../services/discussionFactureAPI";

type Props = { factureId: number | null };

function formatDate(value: string): string {
	return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function jouerSonEnvoi(): void {
	try {
		const contexte = new AudioContext();
		const oscillateur = contexte.createOscillator();
		const volume = contexte.createGain();
		oscillateur.type = "sine";
		oscillateur.frequency.setValueAtTime(720, contexte.currentTime);
		volume.gain.setValueAtTime(0.035, contexte.currentTime);
		volume.gain.exponentialRampToValueAtTime(0.001, contexte.currentTime + 0.09);
		oscillateur.connect(volume).connect(contexte.destination);
		oscillateur.start();
		oscillateur.stop(contexte.currentTime + 0.09);
		oscillateur.addEventListener("ended", () => void contexte.close());
	} catch {
		// Browsers may block audio; sending the message must never be affected.
	}
}

export default function DiscussionFacturePanel({ factureId }: Props) {
	const [messages, setMessages] = useState<DiscussionMessage[]>([]);
	const [contenu, setContenu] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const dernierMessageRef = useRef<HTMLDivElement>(null);
	const ajouterMessage = useCallback((message: DiscussionMessage) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]), []);

	useEffect(() => {
		setMessages([]);
		setError(null);
		if (factureId === null) return;
		setIsLoading(true);
		void obtenirDiscussionFacture(factureId)
			.then((discussion) => setMessages((current) => [...new Map([...current, ...discussion.messages].map((message) => [message.id, message])).values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt))))
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Impossible de charger la discussion."))
			.finally(() => setIsLoading(false));
	}, [factureId]);

	useEffect(() => {
		let ferme = false;
		let arreter: (() => void) | undefined;
		if (factureId === null) return;
		void suivreDiscussionFacture(
			factureId,
			(message) => { if (!ferme) ajouterMessage(message); },
			(cause) => { if (!ferme) setError(cause.message || "La connexion temps réel est indisponible."); },
		).then((desabonner) => { if (ferme) desabonner(); else arreter = desabonner; }).catch((cause: unknown) => { if (!ferme) setError(cause instanceof Error ? cause.message : "La connexion temps réel est indisponible."); });
		return () => { ferme = true; arreter?.(); };
	}, [factureId, ajouterMessage]);

	useEffect(() => {
		dernierMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
	}, [messages.length]);

	async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (factureId === null || contenu.trim() === "" || isSending) return;
		setIsSending(true);
		setError(null);
		try {
			const message = await envoyerMessageDiscussion(factureId, contenu.trim());
			ajouterMessage(message);
			jouerSonEnvoi();
			setContenu("");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Le message n’a pas pu être envoyé.");
		} finally {
			setIsSending(false);
		}
	}

	return (
		<section className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
				<MessageSquare size={18} className="text-indigo-600" />
				<div><h2 className="text-sm font-extrabold text-slate-800">Discussion entre acteurs</h2><p className="text-xs text-slate-500">Échange lié à la facture sélectionnée.</p></div>
			</div>
			{factureId === null ? <p className="p-4 text-sm text-slate-500">Sélectionnez une facture pour consulter sa discussion.</p> : <>
				<div className="max-h-64 space-y-3 overflow-y-auto p-4">
					{isLoading && <p className="flex items-center gap-2 text-xs text-indigo-600"><LoaderCircle size={14} className="animate-spin" />Chargement…</p>}
					{!isLoading && messages.length === 0 && <p className="text-sm text-slate-500">Aucun message pour le moment.</p>}
					{messages.map((message) => <article key={message.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex justify-between gap-3 text-xs"><span className="font-bold text-slate-700">{message.auteur.nom}</span><time className="text-slate-400">{formatDate(message.createdAt)}</time></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{message.contenu}</p></article>)}
					<div ref={dernierMessageRef} aria-hidden="true" />
				</div>
				{error && <p className="mx-4 mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700" role="alert">{error}</p>}
				<form className="flex gap-2 border-t border-slate-100 p-3" onSubmit={submit}><input className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="Écrire un message…" value={contenu} onChange={(event) => setContenu(event.target.value)} disabled={isSending} /><button type="submit" className="rounded-xl bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:opacity-50" aria-label="Envoyer le message" disabled={isSending || contenu.trim() === ""}><Send size={16} /></button></form>
			</>}
		</section>
	);
}
