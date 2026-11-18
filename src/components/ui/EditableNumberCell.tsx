import { useState } from "react";
import { Check, X } from "lucide-react";

type Props = {
	value: number;
	className?: string;
	isLocked?: boolean;
	placeholder?: string;
	emptyValue?: string;
	onSave: (value: number) => void;
};

const numericPattern = /^\d*(?:[.,]\d*)?$/;
const numberFormatter = new Intl.NumberFormat("fr-FR", {
	maximumFractionDigits: 0,
});

export default function EditableNumberCell({
	value,
	className = "",
	isLocked = false,
	placeholder,
	emptyValue = "",
	onSave,
}: Props) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(String(value));

	const startEditing = () => {
		if (isLocked || editing) return;
		setDraft(String(value));
		setEditing(true);
	};

	const commit = () => {
		if (draft.trim() !== "") {
			const nextValue = Number(draft.replace(",", "."));
			if (Number.isFinite(nextValue)) onSave(nextValue);
		}
		setEditing(false);
	};

	const closeIfUnchanged = () => {
		const nextValue = Number(draft.replace(",", "."));
		if (draft.trim() === "" ? value === 0 : Number.isFinite(nextValue) && nextValue === value) {
			setEditing(false);
		}
	};

	return (
		<td
			className={`relative h-full truncate text-left text-sm font-semibold tabular-nums ${isLocked ? "cursor-not-allowed bg-slate-100 text-slate-400" : "cursor-text hover:bg-red-50/40"} ${className}`}
			onClick={startEditing}
			onMouseLeave={closeIfUnchanged}
		>
			{editing ? (
				<>
					<div className="flex min-w-0 items-center gap-1">
						<input
							autoFocus
							type="text"
							inputMode="decimal"
							className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-left text-sm font-semibold tabular-nums text-slate-800 shadow-sm transition focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
							placeholder={placeholder}
							value={draft}
							onChange={(event) => {
								const nextDraft = event.target.value;
								if (numericPattern.test(nextDraft)) setDraft(nextDraft);
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter") commit();
								if (event.key === "Escape") setEditing(false);
							}}
						/>
						<span className="flex shrink-0 gap-0.5">
							<button
								type="button"
								className="rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-50"
								onClick={(event) => {
									event.stopPropagation();
									commit();
								}}
								aria-label="Valider"
							>
								<Check size={14} />
							</button>
							<button
								type="button"
								className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100"
								onClick={(event) => {
									event.stopPropagation();
									setEditing(false);
								}}
								aria-label="Annuler"
							>
								<X size={14} />
							</button>
						</span>
					</div>
				</>
			) : (
				value === 0 && emptyValue
					? <span className="absolute inset-0 flex items-center justify-start pl-3">{emptyValue}</span>
					: numberFormatter.format(value)
			)}
		</td>
	);
}
