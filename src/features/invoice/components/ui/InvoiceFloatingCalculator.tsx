import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator, Copy, X } from "lucide-react";

function evaluateExpression(expression: string): number | null {
	let position = 0;

	function parseFactor(): number {
		if (expression[position] === "+") {
			position++;
			return parseFactor();
		}
		if (expression[position] === "-") {
			position++;
			return -parseFactor();
		}
		const match = expression.slice(position).match(/^(?:\d+\.?\d*|\.\d+)/);
		if (!match) throw new Error("Nombre attendu");
		position += match[0].length;
		return Number(match[0]);
	}

	function parseTerm(): number {
		let value = parseFactor();
		while (expression[position] === "*" || expression[position] === "/") {
			const operator = expression[position++];
			const nextValue = parseFactor();
			if (operator === "/" && nextValue === 0) throw new Error("Division par zéro");
			value = operator === "*" ? value * nextValue : value / nextValue;
		}
		return value;
	}

	function parseSum(): number {
		let value = parseTerm();
		while (expression[position] === "+" || expression[position] === "-") {
			const operator = expression[position++];
			const nextValue = parseTerm();
			value = operator === "+" ? value + nextValue : value - nextValue;
		}
		return value;
	}

	try {
		if (!expression) return null;
		const value = parseSum();
		return position === expression.length && Number.isFinite(value) ? value : null;
	} catch {
		return null;
	}
}

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 8 });
const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "+", "="];

export default function InvoiceFloatingCalculator({
	showLabel = false,
}: {
	showLabel?: boolean;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [panelMounted, setPanelMounted] = useState(false);
	const [expression, setExpression] = useState("");
	const [result, setResult] = useState<number | null>(null);
	const [copied, setCopied] = useState(false);
	const [copyError, setCopyError] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const expressionRef = useRef<HTMLInputElement>(null);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const animationFrameRef = useRef<number | null>(null);

	function openCalculator() {
		if (closeTimerRef.current !== null) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
		setPanelMounted(true);
		animationFrameRef.current = requestAnimationFrame(() => setIsOpen(true));
	}

	function closeCalculator() {
		if (animationFrameRef.current !== null) {
			cancelAnimationFrame(animationFrameRef.current);
			animationFrameRef.current = null;
		}
		setIsOpen(false);
		triggerRef.current?.focus();
		closeTimerRef.current = setTimeout(() => {
			setPanelMounted(false);
			closeTimerRef.current = null;
		}, 160);
	}

	useEffect(() => {
		if (!isOpen) return;
		const input = expressionRef.current;
		input?.focus();
		const end = input?.value.length ?? 0;
		input?.setSelectionRange(end, end);
	}, [isOpen]);

	useEffect(() => () => {
		if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
		if (animationFrameRef.current !== null) {
			cancelAnimationFrame(animationFrameRef.current);
		}
	}, []);

	function calculate() {
		const nextResult = evaluateExpression(expression.replace(/,/g, "."));
		if (nextResult !== null) setResult(nextResult);
	}

	function pressKey(key: string) {
		setCopied(false);
		setCopyError(false);
		if (key === "C") {
			setExpression("");
			setResult(null);
			return;
		}
		if (key === "=") {
			calculate();
			return;
		}
		if (["+", "-", "*", "/"].includes(key)) {
			const currentExpression = result !== null ? String(result) : expression;
			if (!currentExpression && !["-", "+"].includes(key)) return;
			if (/[+\-*/]$/.test(currentExpression) && !["-", "+"].includes(key)) {
				setExpression(`${currentExpression.slice(0, -1)}${key}`);
			} else {
				setExpression(`${currentExpression}${key}`);
			}
			setResult(null);
			return;
		}
		const currentExpression = result !== null ? "" : expression;
		if (
			key === "." &&
			currentExpression.match(/[\d.,]+$/)?.[0].match(/[.,]/)
		) {
			return;
		}
		setExpression(`${currentExpression}${key === "." && (!currentExpression || /[+\-*/(]$/.test(currentExpression)) ? "0." : key}`);
		setResult(null);
	}

	function handleExpressionChange(value: string) {
		const nextExpression = value.replace(/\s/g, "");
		if (!/^[\d.,+\-*/]*$/.test(nextExpression)) return;
		setExpression(nextExpression);
		setResult(null);
		setCopied(false);
		setCopyError(false);
	}

	function deleteLastCharacter() {
		const currentExpression = result !== null ? String(result) : expression;
		setExpression(currentExpression.slice(0, -1));
		setResult(null);
		setCopied(false);
		setCopyError(false);
	}

	async function copyResult() {
		if (result === null) return;
		try {
			await navigator.clipboard.writeText(String(result));
			setCopied(true);
			setCopyError(false);
		} catch {
			setCopyError(true);
			setCopied(false);
		}
	}

	return (
		<>
			{panelMounted && createPortal(
				<section
					className={`fixed bottom-24 right-6 z-[60] w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
						isOpen
							? "pointer-events-auto translate-y-0 scale-100 opacity-100"
							: "pointer-events-none translate-y-2 scale-95 opacity-0"
					}`}
					aria-label="Calculatrice"
					aria-hidden={!isOpen}
					inert={!isOpen}
				>
					<header className="mb-3 flex items-center justify-between">
						<h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Calculator size={17} /> Calculatrice</h2>
						<button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Fermer la calculatrice" onClick={closeCalculator}><X size={17} /></button>
					</header>
					<div className="mb-3 flex min-h-16 flex-col items-end justify-center rounded-lg bg-slate-100 px-3 py-2 text-right">
						<input
							ref={expressionRef}
							type="text"
							inputMode="decimal"
							autoComplete="off"
							aria-label="Expression à calculer"
							className="w-full bg-transparent text-right text-sm text-slate-700 outline-none placeholder:text-slate-500"
							placeholder="Saisir une opération"
							value={expression}
							onChange={(event) => handleExpressionChange(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === "=") {
									event.preventDefault();
									calculate();
								}
								if (event.key === "Escape") closeCalculator();
							}}
						/>
						{result !== null && <div className="max-w-full truncate text-xl font-bold text-slate-900">{numberFormatter.format(result)}</div>}
					</div>
					<div className="mb-2 grid grid-cols-2 gap-2">
						<button type="button" className="h-9 rounded-lg bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100" onClick={() => pressKey("C")}>C</button>
						<button type="button" className="h-9 rounded-lg bg-slate-100 text-sm font-semibold text-slate-800 hover:bg-slate-200" aria-label="Effacer le dernier caractère" title="Effacer le dernier caractère" onClick={deleteLastCharacter}>⌫</button>
					</div>
					<div className="grid grid-cols-4 gap-2">
						{keys.map((key) => (
							<button
								key={key}
								type="button"
								className={`h-10 rounded-lg text-sm font-semibold transition ${key === "=" || ["+", "-", "*", "/"].includes(key) ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-100 text-slate-800 hover:bg-slate-200"} ${key === "0" ? "col-span-2" : ""}`}
								onClick={() => pressKey(key)}
							>
								{key === "*" ? "×" : key === "/" ? "÷" : key}
							</button>
						))}
					</div>
					{result !== null && (
						<button type="button" className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={copyResult}>
							<Copy size={15} /> {copied ? "Copié" : copyError ? "Copie impossible" : "Copier le résultat"}
						</button>
					)}
				</section>,
				document.body,
			)}
			<button
				ref={triggerRef}
				type="button"
				className={showLabel
					? "inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
					: "flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300"}
				aria-label={isOpen ? "Fermer la calculatrice" : "Ouvrir la calculatrice"}
				title={isOpen ? "Fermer la calculatrice" : "Ouvrir la calculatrice"}
				aria-expanded={isOpen}
				onClick={() => isOpen ? closeCalculator() : openCalculator()}
			>
				<Calculator size={23} />
				{showLabel && <span className="hidden sm:inline">Calculatrice</span>}
			</button>
		</>
	);
}
