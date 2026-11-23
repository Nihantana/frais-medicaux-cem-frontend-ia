import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { ErrorBlock, PageHeader } from "../components/ui";
import { InfoBlock } from "../components/ui/Feedback";
import {
  listerConsommations,
  type ConsommationT6Filters,
  type ConsommationT6Item,
  type ConsommationT6ListResponse,
  type TypeConsommationT6,
} from "../features/consumption/services/consommations";
import { formatDate } from "../utils/format";

type Filters = Required<Pick<ConsommationT6Filters, "idp" | "du" | "au">> & {
  type: "" | TypeConsommationT6;
};

const EMPTY_FILTERS: Filters = { type: "", idp: "", du: "", au: "" };
const amountFormat = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const amount = (value: string): string => amountFormat.format(Number(value));

function consumptionLabel(type: TypeConsommationT6): string {
  switch (type) {
    case "MEDICAMENT":
      return "Médicament";
    case "LUNETTES":
      return "Lunettes";
    case "AUTRE":
      return "Autre";
  }
}

function consumptionDetail(item: ConsommationT6Item): string {
  if (item.medicament) {
    return [
      item.medicament.nom,
      `quantité : ${item.quantite ?? "—"}`,
      item.posologie ? `posologie : ${item.posologie}` : null,
    ]
      .filter((value): value is string => value !== null)
      .join(" — ");
  }
  if (item.lunettes) {
    const correction = [
      item.lunettes.sphereOD ||
      item.lunettes.cylindreOD ||
      item.lunettes.axeOD !== null
        ? `OD S ${item.lunettes.sphereOD ?? "—"} C ${item.lunettes.cylindreOD ?? "—"} A ${item.lunettes.axeOD ?? "—"}`
        : null,
      item.lunettes.sphereOG ||
      item.lunettes.cylindreOG ||
      item.lunettes.axeOG !== null
        ? `OG S ${item.lunettes.sphereOG ?? "—"} C ${item.lunettes.cylindreOG ?? "—"} A ${item.lunettes.axeOG ?? "—"}`
        : null,
    ]
      .filter((value): value is string => value !== null)
      .join(" · ");
    return [
      item.lunettes.typeVerre,
      item.lunettes.monture ? `Monture : ${item.lunettes.monture}` : null,
      correction || null,
    ]
      .filter((value): value is string => value !== null)
      .join(" — ");
  }
  return item.description ?? item.libelle;
}

export default function ConsommationsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<ConsommationT6ListResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listerConsommations({
        ...appliedFilters,
        type: appliedFilters.type || undefined,
        idp: appliedFilters.idp.trim() || undefined,
        du: appliedFilters.du || undefined,
        au: appliedFilters.au || undefined,
        page,
        limit: 50,
      });
      setResponse(result);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible de charger le suivi des consommations.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  }

  const totalPages = Math.max(
    1,
    Math.ceil((response?.total ?? 0) / (response?.limit ?? 50)),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Suivi des consommations"
        description="Consultez les médicaments, lunettes et autres éléments enregistrés sur les lignes T6."
        actions={
          <Link className="btn-secondary" to="/factures/t6">
            Retour au T6
          </Link>
        }
      />
      <InfoBlock message="Les médicaments proviennent du catalogue français BDPM ou sont saisis manuellement. Les produits manuels sont enregistrés dans le référentiel local et signalés comme à vérifier; la BDPM ne garantit pas la disponibilité à Madagascar." />
      <form
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5"
        onSubmit={applyFilters}
      >
        <label className="label">
          Type
          <select
            className="field mt-1"
            value={filters.type}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                type: event.target.value as Filters["type"],
              }))
            }
          >
            <option value="">Tous</option>
            <option value="MEDICAMENT">Médicament</option>
            <option value="LUNETTES">Lunettes</option>
            <option value="AUTRE">Autre</option>
          </select>
        </label>
        <label className="label">
          Bénéficiaire (IDP)
          <input
            className="field mt-1"
            value={filters.idp}
            onChange={(event) =>
              setFilters((current) => ({ ...current, idp: event.target.value }))
            }
          />
        </label>
        <label className="label">
          Du
          <input
            className="field mt-1"
            type="date"
            value={filters.du}
            onChange={(event) =>
              setFilters((current) => ({ ...current, du: event.target.value }))
            }
          />
        </label>
        <label className="label">
          Au
          <input
            className="field mt-1"
            type="date"
            value={filters.au}
            onChange={(event) =>
              setFilters((current) => ({ ...current, au: event.target.value }))
            }
          />
        </label>
        <button className="btn-primary self-end" type="submit">
          <Search size={16} /> Filtrer
        </button>
      </form>

      {error && <ErrorBlock message={error} onRetry={() => void load()} />}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 className="font-bold text-slate-900">
            {response?.total ?? 0} résultat(s)
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={isLoading || page <= 1}
              aria-label="Page précédente"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-sm text-slate-500">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={isLoading || page >= totalPages}
              aria-label="Page suivante"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Chargement des consommations…
          </div>
        ) : !response || response.elements.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Aucune consommation ne correspond aux filtres.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Bénéficiaire</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Détail</th>
                  <th className="px-4 py-3">Facture</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {response.elements.map((item) => (
                  <tr key={item.ligneId} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(item.dateActe)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">
                        {item.nomPrenomBeneficiaire}
                      </div>
                      <div className="text-xs text-slate-500">{item.idp}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {consumptionLabel(item.type)}
                    </td>
                    <td className="min-w-[260px] px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {consumptionDetail(item)}
                      </div>
                      {item.medicament?.statut === "A_VERIFIER" && (
                        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          Référence à vérifier
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>{item.numFacture}</div>
                      <div className="text-xs text-slate-500">
                        {item.refSociale}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      {amount(item.montantActe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
