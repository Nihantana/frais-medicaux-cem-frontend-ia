import { Plus } from "lucide-react";

type Props = {
	onClick: () => void;
	disabled?: boolean;
	ariaLabel?: string;
	title?: string;
	showLabel?: boolean;
	label?: string;
};

export default function AddRowButton({
	onClick,
	disabled = false,
	ariaLabel = "Aller à la ligne d’ajout",
	title = "Aller à la ligne d’ajout",
	showLabel = false,
	label = "Ajouter",
}: Props) {
	return (
		<button
			type="button"
			className={showLabel
				? "inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
				: "flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300"}
			aria-label={ariaLabel}
			title={title}
			disabled={disabled}
			onClick={onClick}
		>
			<Plus size={26} strokeWidth={2.5} />
			{showLabel && <span className="hidden sm:inline">{label}</span>}
		</button>
	);
}
