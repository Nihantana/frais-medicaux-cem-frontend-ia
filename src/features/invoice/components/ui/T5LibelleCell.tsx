import { EditableStringCell } from "../../../../components/ui";
import type { T5ActOption } from "../../hooks/useT5Actes";

type Props = {
	value: string;
	className: string;
	isLocked: boolean;
	canEditRows: boolean;
	targetType?: "acte" | "categorie";
	targetLabel?: string;
	actes: T5ActOption[];
	onSave: (value: string) => void;
	onActeSelect: (acte: T5ActOption) => void;
};

export default function T5LibelleCell({
	value,
	className,
	isLocked,
	canEditRows,
	targetType,
	targetLabel,
	actes,
	onSave,
	onActeSelect,
}: Props) {
	if (targetType === "acte") {
		return <td className={`${className} truncate bg-slate-50`}>{targetLabel || value || "—"}</td>;
	}
	if (!canEditRows) {
		return <td className={`${className} truncate`}>{value || "—"}</td>;
	}
	if (targetType === "categorie" && actes.length > 0) {
		const hasCurrentValue = value !== "" && !actes.some((acte) => acte.label === value);
		return (
			<td className={className}>
				<select
					className="w-full min-w-0 bg-transparent outline-none"
					value={value}
					disabled={isLocked}
					onChange={(event) => {
						const acte = actes.find((item) => item.label === event.target.value);
						if (acte) onActeSelect(acte);
					}}
				>
					<option value="">Sélectionner un acte</option>
					{hasCurrentValue && <option value={value}>{value}</option>}
					{actes.map((acte) => <option key={acte.id} value={acte.label}>{acte.label}</option>)}
				</select>
			</td>
		);
	}
	return (
		<EditableStringCell
			value={value}
			className={className}
			isLocked={isLocked}
			onSave={onSave}
		/>
	);
}
