import { Save } from "lucide-react";

type Props = {
	onClick: () => void;
	disabled?: boolean;
	ariaLabel?: string;
	title?: string;
	showLabel?: boolean;
	label?: string;
};

export default function SaveRowButton({
	onClick,
	disabled = false,
	ariaLabel = "Enregistrer la ligne",
	title = "Enregistrer la ligne",
	showLabel = false,
	label = "Enregistrer",
}: Props) {
	return (
		<button
			type="button"
			className={showLabel
				? "inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:opacity-100"
				: "flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-100"}
			aria-label={ariaLabel}
			title={title}
			disabled={disabled}
			onClick={onClick}
		>
			<Save size={23} strokeWidth={2.4} />
			{showLabel && <span className="hidden sm:inline">{label}</span>}
		</button>
	);
}
