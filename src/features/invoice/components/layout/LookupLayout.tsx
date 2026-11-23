import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { Menu, Search, X } from "lucide-react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  LookupLoadingContext,
  LookupRefreshContext,
  LookupResultContext,
} from "../../context/LookupContext";
import useSearchIdp from "../../hooks/useSearchIdp";
import { fetchIdpLookup } from "../../services/idpLookup";
import logo from "../../../../assets/logo.jpg";

type Props = {
  children: ReactNode;
};

export default function LookupLayout({ children }: Props) {
  const location = useLocation();
  const { id: targetId, refSocial } = useParams();
  const [searchParams] = useSearchParams();
  const targetType = searchParams.get("type") === "acte" ? "acte" : "categorie";

  return (
    <LookupLayoutContent
      key={`${location.pathname}${location.search}`}
      targetId={targetId}
      targetType={targetType}
      refSocial={refSocial}
    >
      {children}
    </LookupLayoutContent>
  );
}

function LookupLayoutContent({
  children,
  targetId,
  targetType,
  refSocial,
}: {
  children: ReactNode;
  targetId?: string;
  targetType: "acte" | "categorie";
  refSocial?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [idp, setIdp] = useState("");
  const searchIdp = useCallback(
    (beneficiaryIdp: string, annee?: number) =>
      fetchIdpLookup(beneficiaryIdp, {
        id: Number(targetId),
        type: targetType,
      }, annee),
    [targetId, targetType],
  );
  const lookup = useSearchIdp(searchIdp);

  async function submitIdp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = idp.trim();
    if (!query) return;
    await lookup.search(query);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[320px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-20 shrink-0 items-center gap-3 border-b border-slate-100 px-5">
          <img
            src={logo}
            alt="Caisse d'Épargne de Madagascar"
            className="h-10 w-auto max-w-[185px] object-contain object-left"
          />
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">
            Suivi des plafonds
          </span>
          <button
            type="button"
            className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le panneau"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <LookupSection
            title="Rechercher un bénéficiaire"
            searchLabel="Identifiant du bénéficiaire"
            searchValue={idp}
            setSearchValue={setIdp}
            onSubmit={submitIdp}
            loading={lookup.isLoading}
            error={lookup.error}
          >
            <InfoField
              label="Nom et prénom"
              value={lookup.result?.beneficiary.nomPrenom}
            />
            <InfoField
              label="Code famille"
              value={lookup.result?.beneficiary.codeFam}
            />
            <InfoField
              label="Observation"
              value={lookup.result?.beneficiary.observationIdp}
            />
          </LookupSection>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-700">
              Informations de l’agent titulaire
            </h2>
            <div className="space-y-2">
              <InfoField
                label="Matricule"
                value={lookup.result?.agent.matricule}
              />
              <InfoField
                label="Nom et prénom"
                value={lookup.result?.agent.nomPrenom}
              />
              <InfoField label="Direction" value={lookup.result?.agent.direction} />
              <InfoField
                label="Agence / Service"
                value={lookup.result?.agent.agenceService}
              />
            </div>
          </section>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[320px]">
        <header className="sticky top-0 z-20 flex h-20 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le panneau de recherche"
          >
            <Menu size={21} />
          </button>
          <div className="hidden items-center gap-2 text-xs text-slate-400 md:flex">
            <span>Frais médicaux</span>
            <span>/</span>
            <span className="font-bold text-slate-700">
              Suivi des plafonds de frais médicaux
            </span>
          </div>
          <div className="ml-auto">
            {refSocial && (
              <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                Réf. sociale{" "}
                <strong className="font-mono text-slate-900">
                  {refSocial}
                </strong>
              </span>
            )}
          </div>
        </header>
        <LookupLoadingContext.Provider value={lookup.isLoading}>
          <LookupResultContext.Provider value={lookup.result}>
            <LookupRefreshContext.Provider value={lookup.refresh}>
              <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
                {children}
              </main>
            </LookupRefreshContext.Provider>
          </LookupResultContext.Provider>
        </LookupLoadingContext.Provider>
      </div>
    </div>
  );
}

function LookupSection({
  title,
  searchLabel,
  searchValue,
  setSearchValue,
  onSubmit,
  loading,
  error,
  children,
}: {
  title: string;
  searchLabel: string;
  searchValue: string;
  setSearchValue: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-700">
        {title}
      </h2>
      <form className="mb-3 flex items-end gap-2" onSubmit={onSubmit}>
        <label className="min-w-0 flex-1">
          <span className="label">{searchLabel}</span>
          <input
            className="field min-w-0"
            type="text"
            value={searchValue}
            required
            onChange={(event) => setSearchValue(event.target.value)}
          />
        </label>
        <button
          className="btn-primary min-h-[2.75rem] shrink-0 px-3"
          type="submit"
          disabled={loading}
        >
          <Search size={16} />
          <span className="text-xs">{loading ? "Recherche…" : "Chercher"}</span>
        </button>
      </form>
      {error && (
        <p className="mb-3 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  const isEmpty = !value?.trim();

  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-slate-500">
        {label}
      </label>
      <input
        className={`field min-h-9 bg-slate-50 text-sm ${isEmpty ? "text-center placeholder:text-slate-400" : ""}`}
        value={value ?? ""}
        placeholder={isEmpty ? "—" : ""}
        readOnly
        aria-label={label}
      />
    </div>
  );
}
