import {
  Bot,
  ChevronRight,
  Send,
  Sparkles,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { questionnerAssistantGlobal } from "../features/invoice/services/assistantGlobalAPI";

type Message = { role: "user" | "assistant"; contenu: string };

const suggestions = [
  "Combien de factures sont en attente de validation ?",
  "Quelles factures ont des anomalies de contrôle ?",
  "Résume la situation globale des factures",
  "Quelles factures ne comportent encore aucun frais médical détaillé ?",
];

export default function AssistantGlobalPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: prefersReducedMotion ? "instant" : "smooth",
    });
  }, [messages, isSending]);

  function playMessageSound(type: "sent" | "received"): void {
    if (!soundEnabled || typeof window.AudioContext === "undefined") return;

    const audioContext =
      audioContextRef.current ?? new window.AudioContext();
    audioContextRef.current = audioContext;

    if (audioContext.state === "suspended") {
      void audioContext.resume().catch((cause: unknown) => {
        console.warn("Impossible de démarrer le son de l’assistant.", cause);
      });
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(type === "sent" ? 620 : 880, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.16);
  }

  async function ask(value: string): Promise<void> {
    const texte = value.trim();
    if (!texte || isSending) return;
    playMessageSound("sent");
    setQuestion("");
    setError(null);
    setMessages((current) => [...current, { role: "user", contenu: texte }]);
    setIsSending(true);
    try {
      const result = await questionnerAssistantGlobal(texte);
      playMessageSound("received");
      setMessages((current) => [
        ...current,
        { role: "assistant", contenu: result.reponse },
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "L’assistant global est indisponible.",
      );
    } finally {
      setIsSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void ask(question);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">
              Analyse intelligente
            </p>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">
              Assistant global
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Analyse transversale des factures et de leur circuit de
              traitement.
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Assistant disponible
        </span>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Conversation</h2>
              <p className="text-xs text-slate-500">
                Réponses fondées sur les 200 factures les plus récemment
                modifiées.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Les réponses sont générées par IA
            </span>
            <button
              type="button"
              onClick={() => setSoundEnabled((enabled) => !enabled)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-200"
              aria-label={
                soundEnabled ? "Désactiver les sons" : "Activer les sons"
              }
              aria-pressed={soundEnabled}
              title={soundEnabled ? "Désactiver les sons" : "Activer les sons"}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{soundEnabled ? "Son activé" : "Son désactivé"}</span>
            </button>
          </div>
        </div>

        <div
          ref={messagesContainerRef}
          className="thin-scrollbar max-h-[65vh] min-h-[25rem] space-y-5 overflow-y-auto bg-slate-50/70 p-4 md:p-6"
          aria-live="polite"
          aria-relevant="additions"
        >
          <div className="assistant-message flex max-w-3xl items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
              <Bot size={17} />
            </div>
            <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">
              Bonjour ! Je peux rechercher des tendances et des factures à
              partir des données disponibles. Je ne prends aucune décision
              métier à votre place.
            </div>
          </div>

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`assistant-message flex items-start gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                  <Bot size={17} />
                </div>
              )}
              <div
                className={`max-w-3xl whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                  message.role === "user"
                    ? "rounded-tr-md bg-red-600 text-white"
                    : "rounded-tl-md border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {message.contenu}
              </div>
              {message.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  <UserRound size={16} />
                </div>
              )}
            </div>
          ))}

          {messages.length === 0 && (
            <div className="grid gap-2 pt-1 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void ask(suggestion)}
                  disabled={isSending}
                  className="assistant-suggestion group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50/60 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {suggestion}
                  <ChevronRight
                    size={17}
                    className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-red-600"
                  />
                </button>
              ))}
            </div>
          )}

          {isSending && (
            <div className="assistant-message flex items-center gap-3 text-sm text-slate-500">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700">
                <Bot size={17} />
              </div>
              <div
                className="flex items-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                role="status"
                aria-label="L’assistant rédige une réponse"
              >
                <span className="assistant-typing-indicator" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p
            className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:mx-6"
            role="alert"
          >
            {error}
          </p>
        )}

        <form
          onSubmit={submit}
          className="flex gap-2 border-t border-slate-100 bg-white p-4 md:p-5"
        >
          <input
            className="field min-w-0 flex-1 rounded-xl border-slate-200 px-4 text-sm focus:border-red-400 focus:ring-red-100"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Posez une question sur les factures…"
            disabled={isSending}
            aria-label="Votre question à l’assistant"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSending || question.trim() === ""}
            aria-label="Envoyer"
          >
            <Send size={17} />
            <span className="hidden sm:inline">Envoyer</span>
          </button>
        </form>
        <p className="px-5 pb-4 text-center text-xs text-slate-400">
          Vérifiez les informations importantes dans les données sources.
        </p>
      </section>
    </div>
  );
}
