import { useMemo, useState } from "react";
import { Copy, MoreHorizontal, Search, X } from "lucide-react";
import { factureGlobaleColumns } from "../../data/tableColumn";
import DropDownCell from "./dropDownCell";
import EditableDateCell from "./editableDateCell";
import EditableMonthCell from "./editableMonthCell";
import { EditableNumberCell, EditableStringCell } from "../../../../components/ui";
import { Badge } from "../../../../components/ui/Badge";
import {
    FACTURE_GLOBALE_UPDATE_KEYS,
    numberColumn,
    dateColumn,
    SaveColumnKey,
} from "../../types/invoiceTable";
import { personnelFactureGlobaleEditableColumns } from "../../data/tableColumn";
import { useAuth } from "../../../auth";
import PrestataireDropdownCell from "./prestataireDropdownCell";
import InvoiceAttachmentsCell from "./invoiceAttachmentsCell";
import { COMPUTED_AMOUNT_KEYS } from "../../utils/invoiceAmounts";

import {
    dateFilterKeys,
    filterFactureGlobaleRows,
    textFilterKeys,
    type DateFilterKey,
    type FactureGlobaleFilters,
    type TextFilterKey,
} from "../../services/filterFactureGlobaleRows";

import type {
    FactureGlobaleRow,
    FactureGlobaleTableProps,
} from "../../types/invoiceTable";


const editableUpdateKeys = new Set<string>(personnelFactureGlobaleEditableColumns);
const updateKeys = new Set<string>(FACTURE_GLOBALE_UPDATE_KEYS);
const amountColumnKeys = new Set<string>(Object.values(numberColumn));
const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function invoiceCellClass(columnKey: string, width: string): string {
    const amountClass = amountColumnKeys.has(columnKey)
        ? "text-left text-sm font-semibold tabular-nums text-slate-700"
        : "";
    return `border-b border-slate-100 px-3 py-3 text-[13px] leading-5 ${width} ${amountClass}`;
}

const STATUS_LABELS: Record<string, string> = {
    ENREGISTREE: "Enregistrée",
    EN_VALIDATION: "En validation",
    RETOURNEE: "Retournée",
    VALIDEE: "Validée",
    SORTIE: "Sortie",
    A_CORRIGER: "À corriger",
    SUPPRESSION_DEMANDEE: "Suppression demandée",
    SUPPRIMEE: "Supprimée",
};

function statusTone(status: string): "green" | "amber" | "red" | "blue" | "slate" {
    if (status === "VALIDEE") return "green";
    if (status === "EN_VALIDATION") return "blue";
    if (status === "RETOURNEE" || status === "A_CORRIGER") return "amber";
    if (status === "SUPPRESSION_DEMANDEE" || status === "SUPPRIMEE") return "red";
    return "slate";
}

function renderStatusCell(row: FactureGlobaleRow, cellClass: string) {
    return (
        <td key="statut" className={cellClass}>
            {row.statut ? (
                <Badge tone={statusTone(row.statut)}>
                    {STATUS_LABELS[row.statut] ?? row.statut.replaceAll("_", " ")}
                </Badge>
            ) : null}
        </td>
    );
}

function filterableFiltersActive(
    filters: FactureGlobaleFilters["text"],
    dates: FactureGlobaleFilters["dates"],
    monthPrestation: FactureGlobaleFilters["monthPrestation"],
) {
    return (
        Object.values(filters).some((value) => Boolean(value?.trim())) ||
        Object.values(dates).some((range) => Boolean(range?.from && range.to)) ||
        Boolean(monthPrestation.month || monthPrestation.year)
    );
}

const monthOptions = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(2026, index, 1));
    return {
        value: String(index + 1),
        label: new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(date),
    };
});

function hasInvoiceData(row: FactureGlobaleRow): boolean {
    return factureGlobaleColumns.some(
        (column) => column.key !== "majT5"
            && column.key !== "piecesJointes"
            && row[column.key] !== ""
            && row[column.key] !== 0,
    );
}

export default function FactureGlobaleTable({
    rows,
    prestataires,
    majT5Options,
    addRowId,
    activeRowId,
    selectedRowId,
    isAddRowVisible,
    containerRef,
    addRowRef,
    onRowSelect,
    onCellChange,
    onAddAttachment,
    onRemoveAttachment,
    onDownloadAttachment,
    onOpenActions,
}: FactureGlobaleTableProps) {
    const { hasPermission } = useAuth();
    const isReadOnly = !hasPermission("invoices.write");
    const canOpenActions =
        hasPermission("invoices.write") ||
        hasPermission("invoices.validate") ||
        hasPermission("envoi-validation") ||
        hasPermission("retour-prestataire") ||
        hasPermission("validation") ||
        hasPermission("retour-correction") ||
        hasPermission("sortie") ||
        hasPermission("modifier-informations") ||
        hasPermission("modifier-montants") ||
        hasPermission("suivi-creer") ||
        hasPermission("suivi-modifier") ||
        hasPermission("suivi-supprimer") ||
        hasPermission("deletions.manage");

    const [openFilter, setOpenFilter] = useState<string | null>(null);
    const [pinnedFilter, setPinnedFilter] = useState<DateFilterKey | null>(null);
    const [textFilters, setTextFilters] = useState<FactureGlobaleFilters["text"]>({});
    const [dateDrafts, setDateDrafts] = useState<FactureGlobaleFilters["dates"]>({});
    const [dateFilters, setDateFilters] = useState<FactureGlobaleFilters["dates"]>({});
    const [monthPrestationFilter, setMonthPrestationFilter] = useState<FactureGlobaleFilters["monthPrestation"]>({
        month: "",
        year: "",
    });
    const [copiedRefSocialId, setCopiedRefSocialId] = useState<number | null>(null);

    async function copyRefSocial(row: FactureGlobaleRow): Promise<void> {
        const value = row.refSocial.trim();
        if (!value) return;
        await navigator.clipboard.writeText(value);
        setCopiedRefSocialId(row.id);
        window.setTimeout(() => {
            setCopiedRefSocialId((current) => current === row.id ? null : current);
        }, 1500);
    }

    const dataRows = useMemo(
        () => rows.filter((row) => row.id !== addRowId),
        [rows, addRowId]
    );

    const addRow = useMemo(
        () => rows.find((row) => row.id === addRowId),
        [rows, addRowId]
    );

    const filteredRows = useMemo(
        () => filterFactureGlobaleRows(dataRows, {
            text: textFilters,
            dates: dateFilters,
            monthPrestation: monthPrestationFilter,
        }),
        [dataRows, textFilters, dateFilters, monthPrestationFilter]
    );

    const visibleRows = useMemo(
        () => [
            ...filteredRows,
            ...(!isReadOnly && isAddRowVisible && addRow ? [addRow] : [])
        ],
        [filteredRows, addRow, isReadOnly, isAddRowVisible]
    );

    function isTextFilterKey(key: string): key is TextFilterKey {
        return (textFilterKeys as readonly string[]).includes(key);
    }

    function isDateFilterKey(key: string): key is DateFilterKey {
        return (dateFilterKeys as readonly string[]).includes(key);
    }

    const prestationYears = useMemo(
        () => Array.from(new Set(dataRows.flatMap((row) =>
            row.moisPrestation ? [String(row.moisPrestation.getUTCFullYear())] : [],
        ))).sort((a, b) => Number(b) - Number(a)),
        [dataRows],
    );

    function applyDateFilter(key: DateFilterKey) {
        const range = dateDrafts[key];

        if (!range?.from || !range.to) return;

        setDateFilters((current) => {
            return { ...current, [key]: range };
        });

        setPinnedFilter(null);
        setOpenFilter(null);
    }

    function clearTextFilter(key: TextFilterKey) {
        setTextFilters((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
    }

    function clearDateFilter(key: DateFilterKey) {
        setDateFilters((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });

        setDateDrafts((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });

        setPinnedFilter(null);
        setOpenFilter(null);
    }

    return (
        <div ref={containerRef} className="min-h-0 flex-1 overflow-auto">
            <table className="h-fit w-max min-w-full table-fixed border-separate border-spacing-0 text-[13px]">

                <thead className="sticky top-0 z-10 bg-slate-50/95 text-left text-slate-600 backdrop-blur">
                    <tr>
                        {factureGlobaleColumns.map((column) => {

                            const textKey = isTextFilterKey(column.key) ? column.key : null;
                            const dateKey = isDateFilterKey(column.key) ? column.key : null;
                            const isPrestationMonthFilter = column.key === "moisPrestation";
                            const filterable = textKey !== null || dateKey !== null || isPrestationMonthFilter;
                            const isOpen = openFilter === column.key;

                            const dateRangeDraft = dateKey
                                ? dateDrafts[dateKey] ?? dateFilters[dateKey]
                                : undefined;

                            return (
                                <th
                                    key={column.key}
                                    className={`relative border-b border-slate-200 px-3 py-3.5 text-left text-[10px] font-bold uppercase leading-4 tracking-[0.055em] ${column.width} ${filterable ? "cursor-pointer transition-colors hover:bg-slate-100" : ""} ${column.key === "majT5" ? "bg-slate-100 text-slate-700" : ""} ${isOpen ? "z-30" : ""}`}
                                    onMouseEnter={() => filterable && (!pinnedFilter || pinnedFilter === column.key) && setOpenFilter(column.key)}
                                    onMouseLeave={() => isOpen && pinnedFilter !== column.key && setOpenFilter(null)}
                                    aria-expanded={filterable ? isOpen : undefined}
                                >
                                    <span className="block w-full text-left">
                                        {column.label}
                                    </span>

                                    {isOpen && (
                                        <div
                                            className="absolute left-0 top-full z-40 w-64 rounded-b-lg border border-slate-200 bg-white p-3 text-slate-800 shadow-xl normal-case"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            {isPrestationMonthFilter ? (
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-semibold text-slate-600">
                                                        Mois
                                                        <select
                                                            aria-label="Filtrer par mois de prestation"
                                                            value={monthPrestationFilter.month}
                                                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs font-normal normal-case outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                                            onChange={(event) => setMonthPrestationFilter((current) => ({
                                                                ...current,
                                                                month: event.target.value,
                                                            }))}
                                                        >
                                                            <option value="">Tous les mois</option>
                                                            {monthOptions.map((month) => (
                                                                <option key={month.value} value={month.value}>{month.label}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                    <label className="block text-xs font-semibold text-slate-600">
                                                        Année
                                                        <select
                                                            aria-label="Filtrer par année de prestation"
                                                            value={monthPrestationFilter.year}
                                                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs font-normal normal-case outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                                            onChange={(event) => setMonthPrestationFilter((current) => ({
                                                                ...current,
                                                                year: event.target.value,
                                                            }))}
                                                        >
                                                            <option value="">Toutes les années</option>
                                                            {prestationYears.map((year) => (
                                                                <option key={year} value={year}>{year}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold normal-case text-slate-600 hover:bg-slate-100"
                                                        onClick={() => setMonthPrestationFilter({ month: "", year: "" })}
                                                    >
                                                        <X size={14} /> Effacer le filtre
                                                    </button>
                                                </div>
                                            ) : textKey ? (
                                                <div>
                                                    <input
                                                        autoFocus
                                                        type="search"
                                                        placeholder={`Rechercher ${column.label.toLocaleLowerCase()}…`}
                                                        value={textFilters[textKey] ?? ""}
                                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-normal normal-case outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                                        onChange={(event) => setTextFilters((current) => ({
                                                            ...current,
                                                            [textKey]: event.target.value
                                                        }))}
                                                    />

                                                    <button
                                                        type="button"
                                                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold normal-case text-slate-600 hover:bg-slate-100"
                                                        onClick={() => clearTextFilter(textKey)}
                                                    >
                                                        <X size={14} /> Effacer le filtre
                                                    </button>
                                                </div>
                                            ) : dateKey ? (
                                                <div className="space-y-2">
                                                    <input
                                                        type="date"
                                                        aria-label="Date de début"
                                                        onFocus={() => {
                                                            setPinnedFilter(dateKey);
                                                            setOpenFilter(dateKey);
                                                        }}
                                                        value={dateDrafts[dateKey]?.from ?? dateFilters[dateKey]?.from ?? ""}
                                                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs font-normal normal-case outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                                        onChange={(event) => setDateDrafts((current) => ({
                                                            ...current,
                                                            [dateKey]: {
                                                                from: event.target.value,
                                                                to: current[dateKey]?.to ?? dateFilters[dateKey]?.to ?? ""
                                                            }
                                                        }))}
                                                    />

                                                    <input
                                                        type="date"
                                                        aria-label="Date de fin"
                                                        onFocus={() => {
                                                            setPinnedFilter(dateKey);
                                                            setOpenFilter(dateKey);
                                                        }}
                                                        value={dateDrafts[dateKey]?.to ?? dateFilters[dateKey]?.to ?? ""}
                                                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs font-normal normal-case outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                                        onChange={(event) => setDateDrafts((current) => ({
                                                            ...current,
                                                            [dateKey]: {
                                                                from: current[dateKey]?.from ?? dateFilters[dateKey]?.from ?? "",
                                                                to: event.target.value
                                                            }
                                                        }))}
                                                    />

                                                    <button
                                                        type="button"
                                                        disabled={!dateRangeDraft?.from || !dateRangeDraft.to}
                                                        className="flex w-full items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                        onClick={() => applyDateFilter(dateKey)}
                                                    >
                                                        <Search size={14} /> Rechercher
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                                        onClick={() => clearDateFilter(dateKey)}
                                                    >
                                                        <X size={14} /> Effacer le filtre
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </th>
                            );
                        })}
                        <th className="w-28 border-b border-slate-200 px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-wide">
                        Actions
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                    {filteredRows.length === 0 &&
                        dataRows.length > 0 &&
                        filterableFiltersActive(textFilters, dateFilters, monthPrestationFilter) && (
                            <tr key="no-results">
                                <td
                                    colSpan={factureGlobaleColumns.length + 1}
                                    className="border-b border-slate-200 px-4 py-6 text-center text-sm text-slate-500"
                                >
                                    Aucune facture ne correspond aux filtres.
                                </td>
                            </tr>
                        )}

                    {visibleRows.map((row, rowIndex) => (
                        <tr
                            key={row.id}
                            ref={row.id === addRowId ? addRowRef : undefined}
                            tabIndex={row.id === addRowId ? -1 : undefined}
                            onClick={() => onRowSelect(row.id)}
                            className={`group h-16 ${isReadOnly ? "" : "cursor-pointer"} text-slate-800 transition-colors duration-150 ${
                                rowIndex % 2 === 1 ? "bg-slate-50/35" : "bg-white"
                            } hover:bg-slate-50 ${
                                row.id === addRowId
                                    ? "invoice-add-row-enter bg-red-50/30 shadow-[inset_3px_0_0_#ef4444]"
                                    : ""
                            } ${
                                (activeRowId ?? selectedRowId) === row.id
                                    ? "relative z-[1] bg-red-50/55 shadow-[inset_3px_0_0_#dc2626]"
                                    : ""
                            }`}
                        >

                            {isReadOnly ? (
                                factureGlobaleColumns.map((column) => {
                                    const cellClass = invoiceCellClass(column.key, column.width);
                                    if (column.key === "statut") return renderStatusCell(row, cellClass);
                                    if (column.key === "piecesJointes") {
                                        return (
                                            <InvoiceAttachmentsCell
                                                key={column.key}
                                                attachments={row.piecesJointes}
                                                readOnly
                                                onAdd={(file) => onAddAttachment(row.id, file)}
                                                onRemove={(attachmentId) => onRemoveAttachment(row.id, attachmentId)}
                                                onDownload={(attachmentId) => onDownloadAttachment(row.id, attachmentId)}
                                            />
                                        );
                                    }
                                    if (column.key === "majT5") {
                                        return hasInvoiceData(row) && row.refSocial.trim() && majT5Options.length > 0 ? (
                                            <DropDownCell
                                                key={column.key}
                                                options={majT5Options}
                                                refSocial={row.refSocial}
                                                className={`${cellClass} bg-slate-50 text-slate-700`}
                                                isLocked={activeRowId !== null}
                                            />
                                        ) : (
                                            <td key={column.key} className={`${cellClass} bg-slate-50 text-slate-700`} />
                                        );
                                    }

                                    const value = row[column.key];
                                    if (column.key === "refSocial") {
                                        return (
                                            <td key={column.key} className={cellClass}>
                                                {row.refSocial ? (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span className="font-mono text-xs font-semibold">{row.refSocial}</span>
                                                        <button
                                                            type="button"
                                                            className="btn-ghost p-1"
                                                            title={copiedRefSocialId === row.id ? "Référence copiée" : "Copier la référence sociale"}
                                                            aria-label={`Copier la référence sociale ${row.refSocial}`}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                void copyRefSocial(row);
                                                            }}
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                        {copiedRefSocialId === row.id && (
                                                            <span className="text-[11px] font-semibold text-emerald-700" role="status">Référence copiée</span>
                                                        )}
                                                    </span>
                                                ) : null}
                                            </td>
                                        );
                                    }
                                    return (
                                        <td key={column.key} className={cellClass}>
                                            {value instanceof Date
                                                ? (() => {
                                                    const iso = value instanceof Date ? value.toISOString().slice(0, 10) : "";
                                                    const [year, month, day] = iso.split("-");
                                                    return year && month && day ? `${day}/${month}/${year}` : "";
                                                })()
                                                : typeof value === "number"
                                                    ? amountFormatter.format(value)
                                                    : String(value ?? "")}
                                        </td>
                                    );
                                })
                            ) : row.id !== addRowId ? (

                                factureGlobaleColumns.map((column) => {

                                    const onSave = (nextValue: string) =>
                                        onCellChange(row.id, column.key, nextValue);

                                    const cellClass = invoiceCellClass(column.key, column.width);
                                    if (column.key === "statut") return renderStatusCell(row, cellClass);

                                    if (column.key === "piecesJointes") {
                                        return (
                                            <InvoiceAttachmentsCell
                                                key={column.key}
                                                attachments={row.piecesJointes}
                                                readOnly={activeRowId !== null && activeRowId !== row.id}
                                                onAdd={(file) => onAddAttachment(row.id, file)}
                                                onRemove={(attachmentId) => onRemoveAttachment(row.id, attachmentId)}
                                                onDownload={(attachmentId) => onDownloadAttachment(row.id, attachmentId)}
                                            />
                                        );
                                    }

                                    if (column.key === "majT5") {
                                        return activeRowId === null && hasInvoiceData(row) && row.refSocial.trim() && majT5Options.length > 0 ? (
                                            <DropDownCell
                                                key={column.key}
                                                options={majT5Options}
                                                refSocial={row.refSocial}
                                                className={`${cellClass} bg-slate-50 text-slate-700`}
                                            />
                                        ) : (
                                            <td
                                                key={column.key}
                                                className={`${cellClass} bg-slate-50 text-slate-700`}
                                            />
                                        );
                                    }

                                    if (column.key === "nomEtablissement") {
                                        return (
                                            <PrestataireDropdownCell
                                                key={column.key}
                                                options={prestataires}
                                                value={row.nomEtablissement}
                                                className={cellClass}
                                                isLocked={activeRowId !== null && activeRowId !== row.id}
                                                onSelect={(prestataire) => {
                                                    onCellChange(row.id, "prestataireId", prestataire.id);
                                                    onCellChange(row.id, "nomEtablissement", prestataire.nomEtablissement);
                                                    onCellChange(row.id, "localite", prestataire.localite);
                                                }}
                                            />
                                        );
                                    }

                                    const value = row[column.key];

                                    if (column.key === "localite") {
                                        return (
                                            <td
                                                key={column.key}
                                                className={`${cellClass} cursor-default text-slate-600`}
                                                title="La localité est définie par le prestataire sélectionné."
                                            >
                                                {String(row.localite || "—")}
                                            </td>
                                        );
                                    }

                                    if (column.key === "refSocial") {
                                        return (
                                            <td key={column.key} className={cellClass}>
                                                {row.refSocial ? (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span className="font-mono text-xs font-semibold">{row.refSocial}</span>
                                                        <button
                                                            type="button"
                                                            className="btn-ghost p-1"
                                                            title={copiedRefSocialId === row.id ? "Référence copiée" : "Copier la référence sociale"}
                                                            aria-label={`Copier la référence sociale ${row.refSocial}`}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                void copyRefSocial(row);
                                                            }}
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                        {copiedRefSocialId === row.id && (
                                                            <span className="text-[11px] font-semibold text-emerald-700" role="status">Référence copiée</span>
                                                        )}
                                                    </span>
                                                ) : null}
                                            </td>
                                        );
                                    }

                                    if (
                                        !editableUpdateKeys.has(column.key)
                                        || !updateKeys.has(column.key)
                                    ) {
                                        const isLocked = activeRowId !== null && activeRowId !== row.id;
                                        return (
                                            <td
                                                key={column.key}
                                                className={`${cellClass} ${isLocked ? "cursor-not-allowed bg-slate-100 text-slate-400" : "cursor-default"}`}
                                                title={COMPUTED_AMOUNT_KEYS.has(column.key)
                                                    ? "Recalculé automatiquement lors de la modification du montant total, du 100 % CEM ou du dépassement."
                                                    : undefined}
                                            >
                                                {value instanceof Date
                                                    ? (() => {
                                                        const iso = value.toISOString().slice(0, 10);
                                                        const [year, month, day] = iso.split("-");
                                                        return `${day}/${month}/${year}`;
                                                    })()
                                                    : typeof value === "number"
                                                        ? amountFormatter.format(value)
                                                        : String(value ?? "")}
                                            </td>
                                        );
                                    }

                                    if (column.key === "moisPrestation") {
                                        return (
                                            <EditableMonthCell
                                                key={column.key}
                                                value={value as Date | null}
                                                className={cellClass}
                                                isLocked={activeRowId !== null && activeRowId !== row.id}
                                                emptyValue="—"
                                                onSave={(nextValue) => onCellChange(row.id, column.key, nextValue)}
                                            />
                                        );
                                    }

                                    if ((Object.values(dateColumn) as string[]).includes(column.key)) {
                                        return (
                                            <EditableDateCell
                                                key={column.key}
                                                value={value as string}
                                                className={cellClass}
                                                isLocked={activeRowId !== null && activeRowId !== row.id}
                                                emptyValue="—"
                                                onSave={onSave}
                                            />
                                        );
                                    }

                                    if ((Object.values(numberColumn) as string[]).includes(column.key)) {
                                        return (
                                            <EditableNumberCell
                                                key={column.key}
                                                value={value as number}
                                                className={cellClass}
                                                isLocked={activeRowId !== null && activeRowId !== row.id}
                                                emptyValue="—"
                                                onSave={(nextValue) => onCellChange(row.id, column.key, String(nextValue))}
                                            />
                                        );
                                    }

                                    return (
                                        <EditableStringCell
                                            key={column.key}
                                            value={String(value)}
                                            className={cellClass}
                                            isLocked={activeRowId !== null && activeRowId !== row.id}
                                            emptyValue="—"
                                            onSave={onSave}
                                        />
                                    );
                                })

                            ) : (

                                factureGlobaleColumns.map((column) => {

                                    const onSave = (nextValue: string) =>
                                        onCellChange(row.id, column.key, nextValue);

                                    const cellClass = invoiceCellClass(column.key, column.width);
                                    const isAddRowLocked = activeRowId !== null && activeRowId !== row.id;
                                    if (column.key === "statut") return renderStatusCell(row, cellClass);

                                    if (column.key === "piecesJointes") {
                                        return (
                                            <InvoiceAttachmentsCell
                                                key={column.key}
                                                attachments={row.piecesJointes}
                                                disabledMessage={isAddRowLocked
                                                    ? "Une autre ligne est en cours de modification."
                                                    : "Enregistrez d’abord la facture pour gérer ses pièces jointes."}
                                                onAdd={(file) => onAddAttachment(row.id, file)}
                                                onRemove={(attachmentId) => onRemoveAttachment(row.id, attachmentId)}
                                                onDownload={(attachmentId) => onDownloadAttachment(row.id, attachmentId)}
                                            />
                                        );
                                    }

                                    if (column.key === "majT5") {
                                        return (
                                            <td
                                                key={column.key}
                                                className={`${cellClass} bg-slate-50 text-slate-700 ${isAddRowLocked ? "cursor-not-allowed bg-slate-100 text-slate-400" : ""}`}
                                            />
                                        );
                                    }

                                    if (column.key === "nomEtablissement") {
                                        return (
                                            <PrestataireDropdownCell
                                                key={column.key}
                                                options={prestataires}
                                                value={row.nomEtablissement}
                                                className={cellClass}
                                                isLocked={isAddRowLocked}
                                                onSelect={(prestataire) => {
                                                    onCellChange(row.id, "prestataireId", prestataire.id);
                                                    onCellChange(row.id, "nomEtablissement", prestataire.nomEtablissement);
                                                    onCellChange(row.id, "localite", prestataire.localite);
                                                }}
                                            />
                                        );
                                    }

                                    if (column.key === "localite") {
                                        return (
                                            <td
                                                key={column.key}
                                                className={`${cellClass} cursor-default text-slate-600`}
                                                title="La localité est définie par le prestataire sélectionné."
                                            >
                                                {String(row.localite || "—")}
                                            </td>
                                        );
                                    }

                                    const value = row[column.key];

                                    if (column.key === "refSocial") {
                                        return (
                                            <td key={column.key} className={cellClass}>
                                                {row.refSocial ? (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span className="font-mono text-xs font-semibold">{row.refSocial}</span>
                                                        <button
                                                            type="button"
                                                            className="btn-ghost p-1"
                                                            title={copiedRefSocialId === row.id ? "Référence copiée" : "Copier la référence sociale"}
                                                            aria-label={`Copier la référence sociale ${row.refSocial}`}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                void copyRefSocial(row);
                                                            }}
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                        {copiedRefSocialId === row.id && (
                                                            <span className="text-[11px] font-semibold text-emerald-700" role="status">Référence copiée</span>
                                                        )}
                                                    </span>
                                                ) : null}
                                            </td>
                                        );
                                    }

                                    if (!SaveColumnKey.includes(column.key as SaveColumnKey)) {
                                        return (
                                            <td
                                                key={column.key}
                                                className={`${cellClass} ${isAddRowLocked ? "cursor-not-allowed bg-slate-100 text-slate-400" : "cursor-default"}`}
                                                title={COMPUTED_AMOUNT_KEYS.has(column.key)
                                                    ? "Recalculé automatiquement lors de la modification du montant total, du 100 % CEM ou du dépassement."
                                                    : undefined}
                                            >
                                                {value instanceof Date
                                                    ? (() => {
                                                        const iso = value.toISOString().slice(0, 10);
                                                        const [year, month, day] = iso.split("-");
                                                        return `${day}/${month}/${year}`;
                                                    })()
                                                    : typeof value === "number"
                                                        ? amountFormatter.format(value)
                                                        : value}
                                            </td>
                                        );
                                    }

                                    if (
                                        column.key === "dateReception" ||
                                        column.key === "dateFacture"
                                    ) {
                                        return (
                                            <EditableDateCell
                                                key={column.key}
                                                value={value as string}
                                                className={cellClass}
                                                isLocked={activeRowId !== null && activeRowId !== row.id}
                                                emptyValue="—"
                                                onSave={onSave}
                                            />
                                        );
                                    }

                                    if (column.key === "montantTotal") {
                                        return (
                                            <EditableNumberCell
                                                key={column.key}
                                                value={value as number}
                                                className={cellClass}
                                                isLocked={activeRowId !== null && activeRowId !== row.id}
                                                emptyValue="—"
                                                onSave={(nextValue) =>
                                                    onCellChange(row.id, column.key, String(nextValue))
                                                }
                                            />
                                        );
                                    }

                                    return (
                                        <EditableStringCell
                                            key={column.key}
                                            value={String(value)}
                                            className={cellClass}
                                            isLocked={activeRowId !== null && activeRowId !== row.id}
                                            emptyValue="—"
                                            onSave={onSave}
                                        />
                                    );
                                })
                            )}
                            <td className="w-28 px-3 py-3 text-right">
                                {row.id !== addRowId && canOpenActions && (
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onOpenActions(row.id);
                                        }}
                                        disabled={activeRowId !== null && activeRowId !== row.id}
                                        title="Actions de la facture"
                                    >
                                        <MoreHorizontal size={15} />
                                        Actions
                                    </button>
                                )}
                            </td>

                        </tr>
                    ))}

                </tbody>
            </table>
        </div>
    );
}
