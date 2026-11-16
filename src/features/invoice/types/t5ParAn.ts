export type T5ParAnRow = {
	id: number;
	acteId?: number;
	refSocial: string;
	dateActe: string;
	libelle: string;
	montantActe: number;
	montantCumule: number | null;
	soldePlafond: number | null;
	montantDepassement: number | null;
	nomEtablissement: string;
};

export type T5ParAnColumnKey = Exclude<keyof T5ParAnRow, "id">;

export type T5ParAnColumn = {
	key: T5ParAnColumnKey;
	label: string;
	width: string;
};

export type T5ParAnTableProps = {
	rows: T5ParAnRow[];
	focusRefSocial?: string;
	activeRowId?: number | null;
	canEditRows?: boolean;
	targetType?: "acte" | "categorie";
	targetLabel?: string;
	actes?: Array<{ id: number; label: string }>;
	onCellChange: (
		rowId: number,
		key: Extract<T5ParAnColumnKey | "acteId", "dateActe" | "libelle" | "montantActe" | "acteId">,
		value: string | number | { libelle: string; acteId: number },
	) => void;
};
