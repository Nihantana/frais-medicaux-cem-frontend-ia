import { T5X_CONSTRAINT_TYPES, type T5XConstraintType } from "../../types/t5xType";

const CONSTRAINT_LABELS: Record<T5XConstraintType | "SANS_CONTRAINTE", string> = {
	SANS_CONTRAINTE: "Sans suivi",
	PAR_AN: "Suivi annuel",
	PAR_ACTE: "Suivi par acte",
	PAR_SEANCE: "Suivi par séance",
	PAR_AN_PAR_ACTE: "Suivi annuel et par acte",
	EXCLU: "Exclu",
	SUR_DECISION_DG: "Sur décision",
};

type Props = {
	value: T5XConstraintType | "";
	className?: string;
	isLocked?: boolean;
	options?: readonly T5XConstraintType[];
	onSave: (value: T5XConstraintType | "") => void;
};

export default function T5XConstraintCell({ value, className = "", isLocked = false, options = T5X_CONSTRAINT_TYPES, onSave }: Props) {
	return (
		<td className={`px-2 py-2 ${className}`}>
			<select
				aria-label="Type de contrainte"
				disabled={isLocked}
				className="w-full cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
				value={value}
				onChange={(event) => onSave(event.target.value as T5XConstraintType | "")}
			>
				{options.map((constraint) => (
					<option key={constraint} value={constraint}>
						{CONSTRAINT_LABELS[constraint]}
					</option>
				))}
			</select>
		</td>
	);
}
