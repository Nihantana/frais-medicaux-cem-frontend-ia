export type T5ParSeanceRow = {
	id: number;
	acteId?: number;
	refSocial: string;
	dateActe: string;
	libelle: string;
	montantActe: number;
	numeroSeance: string;
	montantDepassement: number;
	nomEtablissement: string;
};

export type T5ParSeanceColumnKey = Exclude<keyof T5ParSeanceRow, "id">;

export type T5ParSeanceColumn = {
	key: T5ParSeanceColumnKey;
	label: string;
	width: string;
};

export type T5ParSeanceTableProps = {
	rows: T5ParSeanceRow[];
	focusRefSocial?: string;
	activeRowId?: number | null;
	canEditRows?: boolean;
	targetType?: "acte" | "categorie";
	targetLabel?: string;
	actes?: Array<{ id: number; label: string }>;
	onCellChange: (
		rowId: number,
		key: Extract<T5ParSeanceColumnKey | "acteId", "dateActe" | "libelle" | "montantActe" | "acteId">,
		value: string | number | { libelle: string; acteId: number },
	) => void;
};
