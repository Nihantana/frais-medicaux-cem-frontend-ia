import { Bot, ChevronRight, LoaderCircle, Send, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { questionnerAssistantGlobal } from "../features/invoice/services/assistantGlobalAPI";

type Message = { role: "user" | "assistant"; contenu: string };
const suggestions = ["Combien de factures sont en attente de validation ?", "Quelles factures ont des anomalies de contrôle ?", "Résume la situation globale des factures", "Quelles factures n’ont aucune ligne T6 ?"];

export default function AssistantGlobalPage() {
	const [question, setQuestion] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function ask(value: string): Promise<void> {
		const texte = value.trim();
		if (!texte || isSending) return;
		setQuestion("");
		setError(null);
		setMessages((current) => [...current, { role: "user", contenu: texte }]);
		setIsSending(true);
		try {
			const result = await questionnerAssistantGlobal(texte);
			setMessages((current) => [...current, { role: "assistant", contenu: result.reponse }]);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "L’assistant global est indisponible.");
		} finally {
			setIsSending(false);
		}
	}

	function submit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		void ask(question);
	}

	return <div className="mx-auto max-w-5xl">
		<div className="mb-5 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><Sparkles size={23} /></div><div><h1 className="text-2xl font-extrabold text-slate-900">Assistant global</h1><p className="text-sm text-slate-500">Analyse transversale des factures et de leur circuit de traitement.</p></div></div>
		<section className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-indigo-100 bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white"><Bot size={22} /><div><h2 className="font-extrabold">Vue d’ensemble</h2><p className="text-xs text-indigo-100">Les réponses s’appuient sur les 200 factures les plus récemment modifiées.</p></div></div>
			<div className="min-h-[25rem] space-y-3 p-5"><div className="max-w-2xl rounded-2xl rounded-bl-sm bg-indigo-50 p-4 text-sm text-indigo-900">Je peux rechercher des tendances et des factures à partir des données disponibles. Je ne prends aucune décision métier à votre place.</div>{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-3xl whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}>{message.contenu}</div></div>)}{messages.length === 0 && <div className="grid gap-2 pt-4 md:grid-cols-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void ask(suggestion)} disabled={isSending} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-sm text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50">{suggestion}<ChevronRight size={16} className="text-indigo-500" /></button>)}</div>}{isSending && <p className="flex items-center gap-2 text-xs text-indigo-600"><LoaderCircle size={14} className="animate-spin" />Analyse des factures en cours…</p>}</div>
			{error && <p className="mx-5 mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
			<form onSubmit={submit} className="flex gap-2 border-t border-slate-100 p-4"><input className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Posez une question sur les factures…" disabled={isSending} /><button type="submit" className="rounded-xl bg-indigo-600 px-4 text-white hover:bg-indigo-700 disabled:opacity-50" disabled={isSending || question.trim() === ""} aria-label="Envoyer"><Send size={17} /></button></form>
		</section>
	</div>;
}
