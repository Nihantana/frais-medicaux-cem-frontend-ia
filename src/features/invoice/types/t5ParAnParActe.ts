export type T5ParAnParActeRow = {
	id: number;
	acteId?: number;
	refSocial: string;
	dateActe: string;
	libelle: string;
	montantActe: number;
	depassementActe: number;
	cumulActeConsomme: number;
	soldePlafond: number;
	depassementPlafond: number;
	totalDepassement: number;
	nomEtablissement: string;
};

export type T5ParAnParActeColumnKey = Exclude<keyof T5ParAnParActeRow, "id">;

export type T5ParAnParActeColumn = {
	key: T5ParAnParActeColumnKey;
	label: string;
	width: string;
};

export type T5ParAnParActeTableProps = {
	rows: T5ParAnParActeRow[];
	focusRefSocial?: string;
	activeRowId?: number | null;
	canEditRows?: boolean;
	targetType?: "acte" | "categorie";
	targetLabel?: string;
	actes?: Array<{ id: number; label: string }>;
	onCellChange: (
		rowId: number,
		key: Extract<T5ParAnParActeColumnKey | "acteId", "dateActe" | "libelle" | "montantActe" | "acteId">,
		value: string | number | { libelle: string; acteId: number },
	) => void;
};
