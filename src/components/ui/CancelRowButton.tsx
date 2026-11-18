import { RotateCcw } from "lucide-react";

type Props = {
	onClick: () => void;
	disabled?: boolean;
	ariaLabel?: string;
	title?: string;
	showLabel?: boolean;
	label?: string;
};

export default function CancelRowButton({
	onClick,
	disabled = false,
	ariaLabel = "Annuler les modifications de la ligne",
	title = "Annuler les modifications",
	showLabel = false,
	label = "Annuler",
}: Props) {
	return (
		<button
			type="button"
			className={showLabel
				? "inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-60"
				: "flex h-14 w-14 items-center justify-center rounded-full bg-red-700 text-white shadow-lg transition hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"}
			aria-label={ariaLabel}
			title={title}
			disabled={disabled}
			onClick={onClick}
		>
			<RotateCcw size={22} strokeWidth={2.4} />
			{showLabel && <span className="hidden sm:inline">{label}</span>}
		</button>
	);
}
