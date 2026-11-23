import { useParams, useSearchParams } from "react-router-dom";
import {
  useLookupLoading,
  useLookupResult,
} from "../features/invoice/context/LookupContext";
import T5ParSeanceTable from "../features/invoice/components/ui/t5ParSeanceTable";
import T5PageHeader from "../features/invoice/components/ui/T5PageHeader";
import T5SearchPrompt from "../features/invoice/components/ui/T5SearchPrompt";
import T5RowActions from "../features/invoice/components/ui/T5RowActions";
import type { T5ParSeanceRow } from "../features/invoice/types/t5ParSeance";
import useT5RowsByRefSocial from "../features/invoice/hooks/useT5RowsByRefSocial";
import useT5Cible from "../features/invoice/hooks/useT5Cible";
import useT5Actes from "../features/invoice/hooks/useT5Actes";
import {
  TypeContrainte,
  type CibleType,
} from "../features/invoice/types/dropDown";
import { ErrorBlock, LoadingState } from "../components/ui";
import { useAuth } from "../features/auth";

function createEmptyParSeanceRow(
  id: number,
  refSocial: string,
  libelle = "",
  acteId?: number,
  nomEtablissement = "",
): T5ParSeanceRow {
  return {
    id,
    acteId,
    refSocial,
    dateActe: "",
    libelle,
    montantActe: 0,
    numeroSeance: "",
    montantDepassement: 0,
    nomEtablissement,
  };
}

export default function T5ParSeance() {
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
    lookupResult?.t5Data.parSeance,
    refSocial,
    createEmptyParSeanceRow,
    "parSeance",
    canEditRows,
    cible?.type === "acte" ? cible.label : "",
    cible?.type === "acte" ? cible.id : undefined,
  );
  if (isCibleLoading)
    return <LoadingState message="Chargement des règles de plafond…" />;
  if (cibleError)
    return (
      <ErrorBlock message={cibleError} onRetry={() => void reloadCible()} />
    );
  if (!cible || cible.typeContrainte !== TypeContrainte.PAR_SEANCE) {
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
  const pageTitle = cible.label || label || "Suivi des séances autorisées";

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[24rem] flex-col gap-2">
      <T5PageHeader
        title={pageTitle}
        description="Suivi du plafond défini par le nombre de séances autorisées."
        refSocial={refSocial}
        details={[
          {
            label: "Type de suivi",
            value: cible.type === "acte" ? "Acte" : "Catégorie",
          },
          {
            label: "Nombre de séances",
            value:
              cible.nombreSeance !== null && cible.nombreSeance !== undefined
                ? String(cible.nombreSeance)
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
            <T5ParSeanceTable
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
