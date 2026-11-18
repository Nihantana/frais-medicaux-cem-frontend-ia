import {
	AlertTriangle,
	Bot,
	CheckCircle2,
	ChevronRight,
	CircleHelp,
	LoaderCircle,
	MessageCircle,
	Send,
	Sparkles,
	X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
	questionnerAssistantFacture,
	type ControleFactureRapport,
	type ControleFactureResultat,
} from "../../services/verificationFactureAPI";

type Props = {
	factureId: number | null;
	rapport: ControleFactureRapport | null;
	isLoading: boolean;
	error: string | null;
	onRun: () => void;
	disabled?: boolean;
};

type Message = { role: "assistant" | "user"; content: string };

const suggestions = [
	"Résumer cette facture",
	"Quels éléments dois-je vérifier ?",
	"Que signifie le statut actuel ?",
	"Pourquoi une action peut-elle être refusée ?",
];

const RESULT_LABELS: Record<string, { title: string; detail?: string }> = {
	PIECES_JOINTES_PRESENTES: { title: "Pièces jointes présentes" },
	PIECES_JOINTES_MANQUANTES: {
		title: "Pièce justificative manquante",
		detail: "Ajoutez au moins une facture ou pièce justificative.",
	},
	DESTINATAIRE_CONFORME: { title: "Destinataire conforme" },
	DESTINATAIRE_INCORRECT: {
		title: "Destinataire incorrect",
		detail: "La facture doit être adressée à la Caisse d’Épargne de Madagascar.",
	},
	DESTINATAIRE_NON_LISIBLE: {
		title: "Destinataire illisible",
		detail: "Vérifiez que le destinataire apparaît clairement sur la facture.",
	},
	MONTANT_FACTURE_DIFFERENT: {
		title: "Montant différent du montant enregistré",
	},
	MONTANT_CHIFFRES_LETTRES_COHERENT: {
		title: "Montant en chiffres et en lettres cohérent",
	},
	MONTANT_CHIFFRES_LETTRES_DIFFERENT: {
		title: "Montant en chiffres et en lettres différent",
	},
	MONTANT_NON_LISIBLE: {
		title: "Montant illisible",
		detail: "Vérifiez le montant dans les documents joints.",
	},
	MONTANT_EN_LETTRES_NON_INTERPRETABLE: {
		title: "Montant en lettres à vérifier",
	},
	PRESTATAIRE_COHERENT: { title: "Prestataire identifié" },
	PRESTATAIRE_DIFFERENT: { title: "Prestataire différent" },
	PRESTATAIRE_NON_LISIBLE: { title: "Prestataire illisible" },
	DATE_FACTURE_COHERENTE: { title: "Date de facture cohérente" },
	DATE_FACTURE_DIFFERENTE: { title: "Date de facture différente" },
	DATE_FACTURE_NON_LISIBLE: { title: "Date de facture illisible" },
	ATTESTATIONS_NON_RATTACHEES: {
		title: "Attestations non rattachées",
		detail: "Vérifiez les attestations liées à cette facture.",
	},
	ACTES_NON_LISIBLES: {
		title: "Actes non lisibles",
		detail: "Vérifiez les actes mentionnés sur la facture.",
	},
	ATTESTATION_PAR_ACTE_PRESENTE: { title: "Attestations présentes" },
	ATTESTATION_PAR_ACTE_INSUFFISANTE: {
		title: "Nombre d’attestations insuffisant",
	},
	ATTESTATION_INVALIDE: { title: "Attestation invalide" },
	ATTESTATION_DEJA_CONSOMMEE: { title: "Attestation déjà consommée" },
	ATTESTATION_PRESTATAIRE_DIFFERENT: {
		title: "Prestataire de l’attestation différent",
	},
	ATTESTATION_BENEFICIAIRE_DIFFERENT: {
		title: "Bénéficiaire de l’attestation différent",
	},
};

const montantFormatter = new Intl.NumberFormat("fr-FR", {
	maximumFractionDigits: 2,
});

function formatAmount(value: number | null): string {
	return value === null ? "—" : `${montantFormatter.format(value)} MGA`;
}

function formatDate(value: string | null): string {
	if (!value) return "—";
	const date = new Date(`${value.slice(0, 10)}T00:00:00`);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

function formatTimestamp(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleString("fr-FR", {
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function isBlocking(resultat: ControleFactureResultat): boolean {
	return (
		resultat.statut === "ANOMALIE" &&
		resultat.gravite === "BLOQUANTE"
	);
}

export default function ControleFactureIAPanel({
	factureId,
	rapport,
	isLoading,
	error,
	onRun,
	disabled = false,
}: Props) {
	const [open, setOpen] = useState(false);
	const [question, setQuestion] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isAsking, setIsAsking] = useState(false);
	const [assistantError, setAssistantError] = useState<string | null>(null);

	const summary = useMemo(() => {
		const resultats = rapport?.resultats ?? [];
		return {
			blocking: resultats.filter(isBlocking).length,
			toVerify: resultats.filter(
				(resultat) => resultat.statut === "A_VERIFIER",
			).length,
			conforming: resultats.filter(
				(resultat) => resultat.statut === "CONFORME",
			).length,
		};
	}, [rapport]);

	async function ask(text: string): Promise<void> {
		const trimmed = text.trim();
		if (!trimmed || factureId === null || isAsking) return;
		setQuestion("");
		setAssistantError(null);
		setMessages((current) => [
			...current,
			{ role: "user", content: trimmed },
		]);
		setIsAsking(true);
		try {
			const result = await questionnerAssistantFacture(factureId, trimmed);
			setMessages((current) => [
				...current,
				{ role: "assistant", content: result.reponse },
			]);
		} catch (cause) {
			setAssistantError(
				cause instanceof Error
					? cause.message
					: "La réponse de l’assistant est indisponible.",
			);
		} finally {
			setIsAsking(false);
		}
	}

	function submit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		void ask(question);
	}

	const verdict =
		summary.blocking > 0
			? {
					label: "À corriger",
					className: "border-red-200 bg-red-50 text-red-800",
					icon: AlertTriangle,
				}
			: summary.toVerify > 0
				? {
						label: "À vérifier",
						className: "border-amber-200 bg-amber-50 text-amber-800",
						icon: CircleHelp,
					}
				: rapport
					? {
							label: "Conforme",
							className: "border-emerald-200 bg-emerald-50 text-emerald-800",
							icon: CheckCircle2,
						}
					: null;

	return (
		<>
			<section className="mb-3 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
							<Sparkles size={19} />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h2 className="text-sm font-extrabold text-slate-900">
									Analyse de la facture
								</h2>
								<span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
									AIDE À LA VÉRIFICATION
								</span>
							</div>
							<p className="mt-0.5 text-xs text-slate-600">
								L’analyse propose des vérifications; la décision reste humaine.
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							className="btn-secondary flex items-center gap-2"
							onClick={() => setOpen(true)}
							disabled={factureId === null}
						>
							<MessageCircle size={16} />
							Poser une question
						</button>
						<button
							type="button"
							className="btn-primary"
							onClick={onRun}
							disabled={isLoading || disabled}
						>
							{isLoading
								? "Analyse…"
								: rapport
									? "Réanalyser"
									: "Lancer le contrôle"}
						</button>
					</div>
				</div>

				{isLoading && (
					<div className="flex items-center gap-2 border-b border-indigo-100 px-4 py-3 text-sm text-indigo-700">
						<LoaderCircle size={16} className="animate-spin" />
						Analyse des informations en cours…
					</div>
				)}
				{error && (
					<p className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
						{error}
					</p>
				)}

				{rapport && (
					<div className="space-y-4 p-4">
						{verdict && (
							<div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${verdict.className}`}>
								<div className="flex items-center gap-2">
									<verdict.icon size={20} />
									<div>
										<p className="text-sm font-extrabold">{verdict.label}</p>
										<p className="text-xs opacity-80">
											{summary.blocking > 0
												? `${summary.blocking} problème${summary.blocking > 1 ? "s" : ""} bloquant${summary.blocking > 1 ? "s" : ""}`
												: summary.toVerify > 0
													? `${summary.toVerify} élément${summary.toVerify > 1 ? "s" : ""} à vérifier`
													: "Tous les contrôles disponibles sont conformes"}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2 text-xs font-bold">
									<span>{summary.conforming} conforme{summary.conforming > 1 ? "s" : ""}</span>
									<span aria-hidden="true">·</span>
									<span>{summary.toVerify} à vérifier</span>
									<span aria-hidden="true">·</span>
									<span>{summary.blocking} bloquant{summary.blocking > 1 ? "s" : ""}</span>
								</div>
							</div>
						)}

						<div className="grid gap-3 lg:grid-cols-4">
							<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
								<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Prestataire</p>
								<p className="mt-1 truncate text-sm font-bold text-slate-900" title={rapport.extraction?.prestataire ?? undefined}>
									{rapport.extraction?.prestataire ?? "Non détecté"}
								</p>
							</div>
							<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
								<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Numéro</p>
								<p className="mt-1 truncate text-sm font-bold text-slate-900" title={rapport.extraction?.numeroFacture ?? undefined}>
									{rapport.extraction?.numeroFacture ?? "Non détecté"}
								</p>
							</div>
							<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
								<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Montant</p>
								<p className="mt-1 text-sm font-bold text-slate-900">
									{formatAmount(rapport.extraction?.montantChiffres ?? null)}
								</p>
							</div>
							<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
								<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Date</p>
								<p className="mt-1 text-sm font-bold text-slate-900">
									{formatDate(rapport.extraction?.dateFacture ?? null)}
								</p>
							</div>
						</div>

						<div>
							<div className="mb-2 flex items-center justify-between">
								<p className="text-sm font-extrabold text-slate-900">Résultat des vérifications</p>
								<p className="text-xs text-slate-500">
									{rapport.updatedAt ? `Dernière analyse : ${formatTimestamp(rapport.updatedAt)}` : ""}
								</p>
							</div>

							{rapport.resultats.length === 0 ? (
								<div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">
									<CheckCircle2 size={18} />
									Aucun point à signaler.
								</div>
							) : (
								<div className="max-h-72 space-y-2 overflow-y-auto pr-1">
									{rapport.resultats.map((resultat) => {
										const label = RESULT_LABELS[resultat.code] ?? {
											title: resultat.code.replaceAll("_", " ").toLowerCase(),
										};
										const blocking = isBlocking(resultat);
										const tone =
											resultat.statut === "CONFORME"
												? "border-emerald-200 bg-emerald-50/60"
												: resultat.statut === "A_VERIFIER"
													? "border-amber-200 bg-amber-50/60"
													: blocking
														? "border-red-200 bg-red-50/60"
														: "border-slate-200 bg-slate-50";
										const icon =
											resultat.statut === "CONFORME"
												? <CheckCircle2 size={18} className="text-emerald-600" />
												: resultat.statut === "A_VERIFIER"
													? <CircleHelp size={18} className="text-amber-600" />
													: <AlertTriangle size={18} className={blocking ? "text-red-600" : "text-slate-500"} />;

										return (
											<details
												key={`${resultat.code}-${resultat.statut}-${resultat.valeurTrouvee ?? ""}`}
												className={`group rounded-xl border px-3 py-2.5 ${tone}`}
											>
												<summary className="cursor-pointer list-none">
													<div className="flex items-start gap-3">
														<div className="mt-0.5 shrink-0">{icon}</div>
														<div className="min-w-0 flex-1">
															<div className="flex flex-wrap items-center justify-between gap-2">
																<p className="text-sm font-bold text-slate-900">
																	{label.title}
																</p>
																<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
																	resultat.statut === "CONFORME"
																		? "bg-emerald-100 text-emerald-700"
																		: resultat.statut === "A_VERIFIER"
																			? "bg-amber-100 text-amber-700"
																			: blocking
																				? "bg-red-100 text-red-700"
																				: "bg-slate-100 text-slate-600"
																}`}>
																	{blocking
																		? "À corriger"
																		: resultat.statut === "CONFORME"
																			? "Conforme"
																			: resultat.statut === "A_VERIFIER"
																				? "À vérifier"
																				: "Information"}
																</span>
															</div>
															{label.detail && (
																<p className="mt-1 text-xs text-slate-600">{label.detail}</p>
															)}
														</div>
													</div>
												</summary>
												<div className="mt-3 grid gap-2 border-t border-slate-200/70 pt-3 text-xs md:grid-cols-2">
													<p className="text-slate-600">
														<span className="font-bold text-slate-800">Attendu : </span>
														{resultat.valeurAttendue ?? "Non applicable"}
													</p>
													<p className="text-slate-600">
														<span className="font-bold text-slate-800">Détecté : </span>
														{resultat.valeurTrouvee ?? "Non détecté"}
													</p>
													{resultat.preuve && (
														<p className="text-slate-600 md:col-span-2">
															<span className="font-bold text-slate-800">Justification : </span>
															{resultat.preuve}
														</p>
													)}
													<p className="text-slate-400 md:col-span-2">
														Référence technique : {resultat.code}
													</p>
												</div>
											</details>
										);
									})}
								</div>
							)}
						</div>
					</div>
				)}
			</section>

			{open && (
				<div className="fixed inset-0 z-50 bg-slate-950/30" onClick={() => setOpen(false)}>
					<aside
						className="assistant-drawer absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
						onClick={(event) => event.stopPropagation()}
					>
						<div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white">
							<div className="flex items-center gap-3">
								<div className="rounded-xl bg-white/15 p-2">
									<Bot size={20} />
								</div>
								<div>
									<h2 className="font-extrabold">Assistant facture</h2>
									<p className="text-xs text-indigo-100">
										Questions sur le rapport disponible
									</p>
								</div>
							</div>
							<button
								type="button"
								className="rounded-lg p-2 hover:bg-white/15"
								onClick={() => setOpen(false)}
								aria-label="Fermer l’assistant"
							>
								<X size={18} />
							</button>
						</div>
						<div className="flex-1 space-y-3 overflow-y-auto p-4">
							<div className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
								J’aide à interpréter le rapport. La décision finale reste toujours humaine.
							</div>
							{messages.map((message, index) => (
								<div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
									<div className={`assistant-message max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
										message.role === "user"
											? "rounded-br-sm bg-indigo-600 text-white"
											: "rounded-bl-sm bg-slate-100 text-slate-700"
									}`}>
										{message.content}
									</div>
								</div>
							))}
							{messages.length === 0 && (
								<div className="space-y-2">
									<p className="text-xs font-bold uppercase tracking-wide text-slate-400">
										Suggestions
									</p>
									{suggestions.map((suggestion) => (
										<button
											key={suggestion}
											type="button"
											className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-sm text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
											onClick={() => void ask(suggestion)}
											disabled={isAsking || factureId === null}
										>
											{suggestion}
											<ChevronRight size={16} className="text-indigo-500" />
										</button>
									))}
								</div>
							)}
						</div>
						{isAsking && (
							<p className="px-4 pb-2 text-xs text-indigo-600">
								L’assistant prépare une réponse…
							</p>
						)}
						{assistantError && (
							<p className="mx-3 mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700" role="alert">
								{assistantError}
							</p>
						)}
						<form
							className="border-t border-slate-100 p-3"
							onSubmit={submit}
						>
							<div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
								<input
									className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
									placeholder="Posez une question…"
									value={question}
									onChange={(event) => setQuestion(event.target.value)}
									disabled={isAsking || factureId === null}
								/>
								<button
									type="submit"
									className="rounded-lg bg-indigo-600 p-2 text-white transition hover:bg-indigo-700 disabled:opacity-50"
									aria-label="Envoyer"
									disabled={isAsking || !question.trim() || factureId === null}
								>
									<Send size={16} />
								</button>
							</div>
						</form>
					</aside>
				</div>
			)}
		</>
	);
}
