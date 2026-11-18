import { useMemo, useState } from "react";
import { EditableNumberCell, EditableStringCell } from "../../../components/ui";
import { t5xTypeColumns } from "../data/tableColumns";
import type { T5XTypeTableProps } from "../types/t5xType";
import useT5XAddRowValues from "../hooks/useT5XAddRowValues";
import T5XConstraintCell from "./ui/T5XConstraintCell";
import T5XFilterHeader from "./ui/T5XFilterHeader";

const cellClass = "border-b border-slate-100 px-3 py-3 text-[13px] leading-5 text-slate-800";
const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
type FilterKey = "nom" | "typeContrainte";

function canEditNumber(type: string, key: "plafondActe" | "plafondAn" | "nombreSeances") {
	if (type === "SANS_CONTRAINTE" || type === "EXCLU" || type === "SUR_DECISION_DG") return false;
	if (key === "plafondActe") return type === "PAR_ACTE" || type === "PAR_AN_PAR_ACTE";
	if (key === "plafondAn") return type === "PAR_AN" || type === "PAR_AN_PAR_ACTE";
	return type === "PAR_SEANCE";
}

export default function T5XTypesTable({ rows, addRowId, activeRowId = null, selectedRowId = null, onRowSelect, containerRef, addRowRef, onCellChange }: T5XTypeTableProps) {
	const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
	const [filters, setFilters] = useState<Partial<Record<FilterKey, string>>>({});
	const dataRows = rows.filter((row) => row.id !== addRowId);
	const addRow = rows.find((row) => row.id === addRowId);
	const { hasAnyValue: addRowHasValues } = useT5XAddRowValues(addRow);
	const visibleRows = useMemo(() => dataRows.filter((row) => {
		const nameFilter = (filters.nom ?? "").trim().toLocaleLowerCase();
		const typeFilter = filters.typeContrainte ?? "";
		return row.id === activeRowId || (
			row.nom.toLocaleLowerCase().includes(nameFilter)
			&& (!typeFilter || row.typeContrainte === typeFilter)
		);
	}), [activeRowId, dataRows, filters]);

	function clearFilter(key: FilterKey) {
		setFilters((current) => {
			const next = { ...current };
			delete next[key];
			return next;
		});
	}

	return (
		<div ref={containerRef} className="min-h-0 flex-1 overflow-auto">
			<table className="h-fit w-max min-w-full table-fixed border-separate border-spacing-0 text-sm">
				<thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
					<tr>
						{t5xTypeColumns.map((column) => {
							const filterKey = column.filterMode ? column.key as FilterKey : null;
							return (
								<T5XFilterHeader
									key={column.key}
									label={column.label}
									width={column.width}
								filterMode={column.filterMode}
									filterValue={filterKey ? filters[filterKey] ?? "" : ""}
									isOpen={Boolean(filterKey && openFilter === filterKey)}
									onMouseEnter={() => filterKey && setOpenFilter(filterKey)}
									onMouseLeave={() => filterKey && openFilter === filterKey && setOpenFilter(null)}
									onFilterChange={(value) => filterKey && setFilters((current) => ({ ...current, [filterKey]: value }))}
									onClear={() => filterKey && clearFilter(filterKey)}
								/>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{visibleRows.length === 0 && dataRows.length > 0 && (
						<tr key="no-results"><td colSpan={t5xTypeColumns.length} className="border-b border-slate-200 px-4 py-6 text-center text-sm text-slate-500">Aucune catégorie de prestation ne correspond aux filtres.</td></tr>
					)}
					{[...visibleRows, ...(addRow ? [addRow] : [])].map((row, index) => (
						<tr
							key={row.id}
							ref={row.id === addRowId ? addRowRef : undefined}
							tabIndex={row.id === addRowId ? -1 : undefined}
							onClick={() => onRowSelect?.(row.id)}
							className={`h-14 cursor-pointer transition-colors duration-150 ${
								index % 2 === 1 ? "bg-slate-50/35" : "bg-white"
							} hover:bg-slate-50 ${
								row.id === addRowId
									? "bg-red-50/30 shadow-[inset_3px_0_0_#ef4444]"
									: ""
							} ${
								(activeRowId ?? selectedRowId) === row.id
									? "relative z-[1] bg-red-50/55 shadow-[inset_3px_0_0_#dc2626]"
									: ""
							}`}
						>
							{t5xTypeColumns.map((column) => {
								const className = `${cellClass} ${column.width}`;
								const isLocked = activeRowId !== null && activeRowId !== row.id;
								if (column.key === "nom") {
									return <EditableStringCell key={column.key} value={row.nom} emptyValue="—" className={className} isLocked={isLocked} onSave={(value) => onCellChange(row.id, "nom", value)} />;
								}
								if (column.key === "typeContrainte") {
										if (row.id === addRowId && !addRowHasValues) {
											return <td key={column.key} className={`${className} text-center align-middle ${isLocked ? "cursor-not-allowed bg-slate-100 text-slate-400" : ""}`}>—</td>;
										}
										return <T5XConstraintCell key={column.key} value={row.typeContrainte || "SANS_CONTRAINTE"} className={className} isLocked={isLocked} onSave={(value) => onCellChange(row.id, "typeContrainte", value)} />;
								}
								if (column.key === "plafondActe" || column.key === "plafondAn" || column.key === "nombreSeances") {
									const value = row[column.key];
									if (canEditNumber(row.typeContrainte, column.key)) {
										return <EditableNumberCell key={column.key} value={value ?? 0} className={`${className} text-left`} isLocked={isLocked} onSave={(nextValue) => onCellChange(row.id, column.key, nextValue)} />;
									}
									const isEmpty = value === null || !Number.isFinite(value);
									return <td key={column.key} className={`${className} ${isEmpty ? "text-center align-middle" : "text-left"} ${isLocked ? "cursor-not-allowed bg-slate-100 text-slate-400" : ""}`}>{isEmpty ? "—" : numberFormatter.format(value)}</td>;
								}
								return null;
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
