import { useParams, useSearchParams } from "react-router-dom";
import {
  useLookupLoading,
  useLookupResult,
} from "../features/invoice/context/LookupContext";
import T5ParAnTable from "../features/invoice/components/ui/t5ParAnTable";
import T5PageHeader from "../features/invoice/components/ui/T5PageHeader";
import T5SearchPrompt from "../features/invoice/components/ui/T5SearchPrompt";
import T5RowActions from "../features/invoice/components/ui/T5RowActions";
import type { T5ParAnRow } from "../features/invoice/types/t5ParAn";
import useT5RowsByRefSocial from "../features/invoice/hooks/useT5RowsByRefSocial";
import useT5Cible from "../features/invoice/hooks/useT5Cible";
import useT5Actes from "../features/invoice/hooks/useT5Actes";
import {
  TypeContrainte,
  type CibleType,
} from "../features/invoice/types/dropDown";
import { ErrorBlock, LoadingState } from "../components/ui";
import { useAuth } from "../features/auth";

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

function createEmptyParAnRow(
  id: number,
  refSocial: string,
  libelle = "",
  acteId?: number,
  nomEtablissement = "",
): T5ParAnRow {
  return {
    id,
    acteId,
    refSocial,
    dateActe: "",
    libelle,
    montantActe: 0,
    montantCumule: null,
    soldePlafond: null,
    montantDepassement: null,
    nomEtablissement,
  };
}

function calculateCreatedParAnRow(
  row: T5ParAnRow,
  rows: T5ParAnRow[],
  plafond: number | undefined,
): Partial<T5ParAnRow> {
  if (plafond === undefined || !Number.isFinite(plafond)) return {};
  const montantCumule = rows
    .filter((item) => item.id !== row.id && item.refSocial === row.refSocial)
    .reduce((total, item) => total + item.montantActe, row.montantActe);
  return {
    montantCumule,
    soldePlafond: Math.max(0, plafond - montantCumule),
    montantDepassement: Math.max(0, montantCumule - plafond),
  };
}

export default function T5ParAn() {
  const { id, label, refSocial } = useParams();
  const [searchParams] = useSearchParams();
  const cibleType: CibleType =
    searchParams.get("type") === "acte" ? "acte" : "categorie";
  const {
    cible,
    isLoading: isCibleLoading,
    error: cibleError,
    reload: reloadCible,
  } = useT5Cible(id, cibleType);
  const categorieId =
    cible?.type === "categorie"
      ? (cible.categorieActeId ?? cible.id)
      : undefined;
  const {
    actes,
    isLoading: isActesLoading,
    error: actesError,
    reload: reloadActes,
  } = useT5Actes(categorieId);
  const lookupResult = useLookupResult();
  const isLookupLoading = useLookupLoading();
  const { hasPermission } = useAuth();
  const canEditRows = hasPermission("follow-up.write");
  const {
    rows,
    isReady,
    activeRowId,
    canSave,
    isSaving,
    saveError,
    updateCell,
    saveActiveRow,
    resetActiveRow,
  } = useT5RowsByRefSocial(
    lookupResult?.t5Data.parAn,
    refSocial,
    createEmptyParAnRow,
    "parAn",
    canEditRows,
    cible?.type === "acte" ? cible.label : "",
    cible?.type === "acte" ? cible.id : undefined,
    (row, rows) => calculateCreatedParAnRow(row, rows, cible?.plafondParAn),
  );
  if (isCibleLoading)
    return <LoadingState message="Chargement des règles de plafond…" />;
  if (cibleError)
    return (
      <ErrorBlock message={cibleError} onRetry={() => void reloadCible()} />
    );
  if (!cible || cible.typeContrainte !== TypeContrainte.PAR_AN) {
    return (
      <ErrorBlock
        message="Les règles de plafond ne correspondent pas à cette page."
        onRetry={() => void reloadCible()}
      />
    );
  }
  if (isActesLoading)
    return <LoadingState message="Chargement des actes de la catégorie…" />;
  if (actesError)
    return (
      <ErrorBlock message={actesError} onRetry={() => void reloadActes()} />
    );
  const pageTitle = cible.label || label || "Suivi du plafond annuel";

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[24rem] flex-col gap-2">
      <T5PageHeader
        title={pageTitle}
        description="Suivi de la consommation du plafond annuel."
        refSocial={refSocial}
        details={[
          {
            label: "Type de suivi",
            value: cible.type === "acte" ? "Acte" : "Catégorie",
          },
          {
            label: "Plafond annuel",
            value:
              cible.plafondParAn !== undefined
                ? `${moneyFormatter.format(cible.plafondParAn)} MGA`
                : "Non défini",
          },
        ]}
      />
      <section className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
        {isLookupLoading ? (
          <LoadingState message="Recherche du bénéficiaire et chargement de son suivi…" />
        ) : !lookupResult ? (
          <T5SearchPrompt refSocial={refSocial} />
        ) : !isReady ? (
          <LoadingState message="Chargement du suivi des dépenses…" />
        ) : (
          <>
            {saveError && <ErrorBlock message={saveError} />}
            <T5ParAnTable
              rows={rows}
              onCellChange={updateCell}
              focusRefSocial={refSocial}
              activeRowId={activeRowId}
              canEditRows={canEditRows}
              targetType={cible.type}
              targetLabel={cible.label}
              actes={actes}
            />
          </>
        )}
      </section>
      {isReady && canEditRows && (
        <T5RowActions
          canSave={canSave}
          hasActiveRow={activeRowId !== null}
          isSaving={isSaving}
          onSave={saveActiveRow}
          onReset={resetActiveRow}
        />
      )}
    </div>
  );
}
