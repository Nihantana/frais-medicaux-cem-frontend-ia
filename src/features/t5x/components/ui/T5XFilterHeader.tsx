import { X } from "lucide-react";
import { T5X_CONSTRAINT_TYPES, type T5XCategoryOption, type T5XConstraintType } from "../../types/t5xType";

const CONSTRAINT_LABELS: Record<string, string> = {
	SANS_CONTRAINTE: "Sans suivi",
	PAR_AN: "Suivi annuel",
	PAR_ACTE: "Suivi par acte",
	PAR_SEANCE: "Suivi par séance",
	PAR_AN_PAR_ACTE: "Suivi annuel et par acte",
	EXCLU: "Exclu",
	SUR_DECISION_DG: "Sur décision",
};

type Props = {
	label: string;
	width: string;
	filterMode?: "text" | "constraint" | "category";
	categories?: T5XCategoryOption[];
	constraintTypes?: readonly T5XConstraintType[];
	filterValue?: string;
	isOpen?: boolean;
	onMouseEnter?: () => void;
	onMouseLeave?: () => void;
	onFilterChange?: (value: string) => void;
	onClear?: () => void;
};

export default function T5XFilterHeader({
	label,
	width,
	filterMode,
	categories = [],
	constraintTypes = T5X_CONSTRAINT_TYPES,
	filterValue = "",
	isOpen = false,
	onMouseEnter,
	onMouseLeave,
	onFilterChange,
	onClear,
}: Props) {
	return (
		<th
			className={`relative border-b border-slate-200 px-3 py-3.5 text-left text-[10px] font-bold uppercase leading-4 tracking-[0.055em] text-slate-600 ${width} ${filterMode ? "cursor-pointer transition-colors hover:bg-slate-100" : ""} ${isOpen ? "z-30 bg-slate-100" : "bg-slate-50/95"}`}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			aria-expanded={filterMode ? isOpen : undefined}
		>
			{label}
			{filterMode && isOpen && (
				<div className="absolute left-0 top-full z-40 w-64 rounded-b-lg border border-slate-200 bg-white p-3 font-normal text-slate-800 shadow-xl" onClick={(event) => event.stopPropagation()}>
					{filterMode === "constraint" ? (
						<select
							aria-label={`Filtrer par ${label.toLocaleLowerCase()}`}
							className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-normal outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
							value={filterValue}
							onChange={(event) => onFilterChange?.(event.target.value)}
						>
							<option value="">Tous les types</option>
							{constraintTypes.map((type) => <option key={type} value={type}>{CONSTRAINT_LABELS[type] ?? type}</option>)}
						</select>
					) : filterMode === "category" ? (
						<select
							aria-label={`Filtrer par ${label.toLocaleLowerCase()}`}
							className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-normal outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
							value={filterValue}
							onChange={(event) => onFilterChange?.(event.target.value)}
						>
							<option value="">Toutes les catégories</option>
							{categories.map((category) => <option key={category.id} value={category.id}>{category.nom}</option>)}
						</select>
					) : (
						<input
							autoFocus
							type="search"
							aria-label={`Filtrer par ${label.toLocaleLowerCase()}`}
							placeholder={`Rechercher ${label.toLocaleLowerCase()}…`}
							className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-normal outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
							value={filterValue}
							onChange={(event) => onFilterChange?.(event.target.value)}
						/>
					)}
					<button
						type="button"
						className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
						onClick={onClear}
					>
						<X size={14} /> Effacer le filtre
					</button>
				</div>
			)}
		</th>
	);
}
