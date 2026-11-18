import { Trash2 } from "lucide-react";

type Props = {
	onClick: () => void;
	disabled?: boolean;
	ariaLabel?: string;
	title?: string;
	showLabel?: boolean;
	label?: string;
};

export default function DeleteRowButton({
	onClick,
	disabled = false,
	ariaLabel = "Supprimer la ligne",
	title = "Supprimer la ligne",
	showLabel = false,
	label = "Supprimer",
}: Props) {
	return (
		<button
			type="button"
			className={showLabel
				? "inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:shadow-none"
				: "flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"}
			aria-label={ariaLabel}
			title={title}
			disabled={disabled}
			onClick={onClick}
		>
			<Trash2 size={22} strokeWidth={2.4} />
			{showLabel && <span className="hidden sm:inline">{label}</span>}
		</button>
	);
}
