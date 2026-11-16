import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  Copy,
  LockKeyhole,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { DataTable, type Column } from "../components/ui/DataTable";
import { ErrorBlock, LoadingState, Modal, PageHeader } from "../components/ui";
import { listActes } from "../services/acte-api";
import {
  cloturerFacture,
  getPaieMois,
} from "../features/invoice/services/paieAPI";
import {
  createFactureLine,
  deleteFactureLine,
  getFactureControleTotaux,
  getFactureLines,
  getFactures,
  updateFactureLine,
  type CreateFactureLineBody,
  type FactureControleTotauxResponse,
  type FactureLinesResponse,
  type FactureListResponse,
  type UpdateFactureLineBody,
} from "../features/invoice/services/serviceAPI";
import type { components } from "../api/schema";

type Facture = FactureListResponse[number];
type Acte = components["schemas"]["ActeResponseDto"];
type Ligne = FactureLinesResponse["lignes"][number];
type LigneAffichee = Ligne & { facture: Facture };
type StatutRapprochement =
  "CONFORME" | "ECART" | "INCOMPLET" | "CALCUL" | "ERREUR";
type Rapprochement = {
  factureId: number;
  statut: StatutRapprochement;
  controle: FactureControleTotauxResponse | null;
  partsAgentT6: {
    montant20Agent: string;
    totalChargeAgent: string;
  } | null;
};
type RapprochementFerme = {
  facture: Facture;
  rapprochement: Rapprochement;
};
type RapprochementItem = {
  label: string;
  t6: string;
  facture: string | null;
  conformity?: boolean | null;
};

type Draft = {
  libelle: string;
  dateActe: string;
  idp: string;
  acteId: string;
  numPec: string;
  refPaie: string;
  montantActe: string;
  montantDepassementActe: string;
  montantDepassementPlafond: string;
  observationDepassement: string;
  moisAffectation: string;
};

const emptyDraft = (): Draft => ({
  libelle: "",
  dateActe: new Date().toISOString().slice(0, 10),
  idp: "",
  acteId: "",
  numPec: "",
  refPaie: "",
  montantActe: "",
  montantDepassementActe: "0",
  montantDepassementPlafond: "0",
  observationDepassement: "",
  moisAffectation: new Date(new Date().setMonth(new Date().getMonth() + 1))
    .toISOString()
    .slice(0, 10),
});

const money = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatMoney = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === ""
    ? "—"
    : money.format(Number(value));
const amountInCents = (
  value: string | number | null | undefined,
): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
};
const compareAmounts = (
  left: string | number | null | undefined,
  right: string | number | null | undefined,
): boolean | null => {
  const leftCents = amountInCents(left);
  const rightCents = amountInCents(right);
  return leftCents === null || rightCents === null
    ? null
    : leftCents === rightCents;
};
const dateOnly = (value: string): string => value.slice(0, 10);
const incrementMonth = (value: string): string => {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 7);
};

export default function T6Page() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [actes, setActes] = useState<Acte[]>([]);
  const [selectedFactureId, setSelectedFactureId] = useState("");
  const [refSocialeQuery, setRefSocialeQuery] = useState("");
  const [editingFactureId, setEditingFactureId] = useState<number | null>(null);
  const [lines, setLines] = useState<LigneAffichee[]>([]);
  const [rapprochement, setRapprochement] = useState<Rapprochement | null>(
    null,
  );
  const [rapprochementFerme, setRapprochementFerme] =
    useState<RapprochementFerme | null>(null);
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const [copiedRefSociale, setCopiedRefSociale] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [clotureConfirmationOpen, setClotureConfirmationOpen] = useState(false);
  const [clotureError, setClotureError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lineRequestId = useRef(0);
  const rapprochementCloseTimer = useRef<number | null>(null);
  const [clotureMois, setClotureMois] = useState(
    new Date(new Date().setMonth(new Date().getMonth() + 1))
      .toISOString()
      .slice(0, 7),
  );

  const selectedFacture = useMemo(
    () =>
      factures.find((facture) => String(facture.id) === selectedFactureId) ??
      null,
    [factures, selectedFactureId],
  );
  const editingFacture = useMemo(
    () => factures.find((facture) => facture.id === editingFactureId) ?? null,
    [editingFactureId, factures],
  );
  const formFacture = editingFacture ?? selectedFacture;
  const factureSuggestions = useMemo(() => {
    const query = refSocialeQuery.trim().toLocaleLowerCase();
    if (!query || selectedFactureId) return [];
    return factures
      .filter((facture) =>
        facture.refSociale.toLocaleLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [factures, refSocialeQuery, selectedFactureId]);
  const acteFromLibelle = actes.find(
    (acte) =>
      acte.nomActe.trim().toLocaleLowerCase() ===
      draft.libelle.trim().toLocaleLowerCase(),
  );
  const selectedActe =
    actes.find((acte) => String(acte.id) === draft.acteId) ?? acteFromLibelle;
  const lineTotals = useMemo(
    () =>
      lines.reduce(
        (totals, line) => ({
          montantActe: (
            Number(totals.montantActe) + Number(line.montantActe)
          ).toFixed(2),
          montantCemIntegral: (
            Number(totals.montantCemIntegral) + Number(line.montantCemIntegral)
          ).toFixed(2),
          montantCem: (
            Number(totals.montantCem) + Number(line.montantCem)
          ).toFixed(2),
          montantAgent: (
            Number(totals.montantAgent) + Number(line.montantAgent)
          ).toFixed(2),
          montantDepassement: (
            Number(totals.montantDepassement) + Number(line.montantDepassement)
          ).toFixed(2),
          totalChargeAgent: (
            Number(totals.totalChargeAgent) + Number(line.totalChargeAgent)
          ).toFixed(2),
        }),
        {
          montantActe: "0.00",
          montantCemIntegral: "0.00",
          montantCem: "0.00",
          montantAgent: "0.00",
          montantDepassement: "0.00",
          totalChargeAgent: "0.00",
        },
      ),
    [lines],
  );

  const loadFacturesAndActes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [facturesResult, actesResult, paiesResult] = await Promise.all([
        getFactures(),
        listActes(),
        getPaieMois(),
      ]);
      setFactures(facturesResult);
      setActes(actesResult);
      if (paiesResult[0])
        setClotureMois(incrementMonth(paiesResult[0].moisPaie));
      setSelectedFactureId((current) =>
        facturesResult.some((facture) => String(facture.id) === current)
          ? current
          : "",
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible de charger les données T6.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLines = useCallback(
    async (factureId?: number) => {
      const requestId = ++lineRequestId.current;
      if (factures.length === 0) {
        setLines([]);
        setRapprochement(null);
        return;
      }
      setError(null);
      const targetId =
        factureId ??
        (selectedFactureId ? Number(selectedFactureId) : undefined);
      setRapprochement(
        targetId === undefined
          ? null
          : {
              factureId: targetId,
              statut: "CALCUL",
              controle: null,
              partsAgentT6: null,
            },
      );
      const facturesCibles =
        targetId !== undefined
          ? factures.filter((facture) => facture.id === targetId)
          : refSocialeQuery.trim()
            ? []
            : factures.filter((facture) => !facture.dateCloture);
      try {
        const responses = await Promise.all(
          facturesCibles.map(async (facture) => {
            const [response, controle] = await Promise.all([
              getFactureLines(facture.id),
              targetId !== undefined && facture.montantTotal !== null
                ? getFactureControleTotaux(facture.id)
                : Promise.resolve(null),
            ]);
            return { facture, response, controle };
          }),
        );
        if (requestId === lineRequestId.current) {
          setLines(
            responses.flatMap(({ facture, response }) =>
              response.lignes.map((line) => ({ ...line, facture })),
            ),
          );
          const factureSelectionnee = responses[0];
          if (targetId !== undefined && factureSelectionnee) {
            const estIncomplet =
              factureSelectionnee.facture.montantTotal === null ||
              factureSelectionnee.response.lignes.length === 0 ||
              factureSelectionnee.controle?.nombreLignes === 0;
            const partsAgentT6 = factureSelectionnee.response.lignes.reduce(
              (totaux, ligne) => ({
                montant20Agent:
                  totaux.montant20Agent + Number(ligne.montantAgent),
                totalChargeAgent:
                  totaux.totalChargeAgent + Number(ligne.totalChargeAgent),
              }),
              { montant20Agent: 0, totalChargeAgent: 0 },
            );
            setRapprochement({
              factureId: targetId,
              statut: estIncomplet
                ? "INCOMPLET"
                : factureSelectionnee.controle?.concordant
                  ? "CONFORME"
                  : "ECART",
              controle: factureSelectionnee.controle,
              partsAgentT6: {
                montant20Agent: partsAgentT6.montant20Agent.toFixed(2),
                totalChargeAgent: partsAgentT6.totalChargeAgent.toFixed(2),
              },
            });
          }
        }
      } catch (caught: unknown) {
        if (requestId !== lineRequestId.current) return;
        if (targetId !== undefined) {
          setRapprochement({
            factureId: targetId,
            statut: "ERREUR",
            controle: null,
            partsAgentT6: null,
          });
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger les lignes.",
        );
        setLines([]);
        setRapprochement(
          targetId === undefined
            ? null
            : {
                factureId: targetId,
                statut: "ERREUR",
                controle: null,
                partsAgentT6: null,
              },
        );
      }
    },
    [factures, refSocialeQuery, selectedFactureId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFacturesAndActes(), 0);
    return () => window.clearTimeout(timer);
  }, [loadFacturesAndActes]);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadLines(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLines]);
  useEffect(
    () => () => {
      if (rapprochementCloseTimer.current !== null) {
        window.clearTimeout(rapprochementCloseTimer.current);
      }
    },
    [],
  );

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function openNewLine() {
    setEditingLineId(null);
    setEditingFactureId(null);
    setDraft(emptyDraft());
    setLineFormOpen(true);
  }
  function startEditing(line: LigneAffichee) {
    setEditingLineId(line.id);
    setEditingFactureId(line.facture.id);
    setDraft({
      libelle: line.libelle,
      dateActe: dateOnly(line.dateActe),
      idp: line.idp,
      acteId: String(line.acte.id),
      numPec: line.numPec ? String(line.numPec) : "",
      refPaie: line.refPaie ?? "",
      montantActe: line.montantActe,
      montantDepassementActe: line.montantDepassementActe,
      montantDepassementPlafond: line.montantDepassementPlafond,
      observationDepassement: line.observationDepassement ?? "",
      moisAffectation: line.moisAffectation
        ? dateOnly(line.moisAffectation)
        : emptyDraft().moisAffectation,
    });
    setLineFormOpen(true);
  }
  function cancelEditing() {
    setEditingLineId(null);
    setEditingFactureId(null);
    setDraft(emptyDraft());
    setLineFormOpen(false);
  }
  function stopRapprochementClose() {
    if (rapprochementCloseTimer.current !== null) {
      window.clearTimeout(rapprochementCloseTimer.current);
      rapprochementCloseTimer.current = null;
    }
    setRapprochementFerme(null);
  }
  function startRapprochementClose() {
    if (!selectedFacture) return;
    setRapprochementFerme({
      facture: selectedFacture,
      rapprochement:
        rapprochement?.factureId === selectedFacture.id
          ? rapprochement
          : {
              factureId: selectedFacture.id,
              statut: "CALCUL",
              controle: null,
              partsAgentT6: null,
            },
    });
    if (rapprochementCloseTimer.current !== null) {
      window.clearTimeout(rapprochementCloseTimer.current);
    }
    rapprochementCloseTimer.current = window.setTimeout(() => {
      setRapprochementFerme(null);
      rapprochementCloseTimer.current = null;
    }, 540);
  }
  function clearFactureSelection() {
    startRapprochementClose();
    setSelectedFactureId("");
    setRefSocialeQuery("");
    setRapprochement(null);
    cancelEditing();
  }
  function selectFacture(facture: Facture) {
    stopRapprochementClose();
    setRefSocialeQuery(facture.refSociale);
    setSelectedFactureId(String(facture.id));
    setRapprochement(null);
    setError(null);
    cancelEditing();
  }
  function searchFacture(value: string) {
    setRefSocialeQuery(value);
    const query = value.trim().toLocaleLowerCase();
    const exactMatch = factures.find(
      (facture) => facture.refSociale.toLocaleLowerCase() === query,
    );
    const nextId = exactMatch ? String(exactMatch.id) : "";
    if (nextId !== selectedFactureId) {
      if (nextId) stopRapprochementClose();
      else startRapprochementClose();
      setSelectedFactureId(nextId);
      setRapprochement(null);
      cancelEditing();
    }
  }

  async function copyRefSociale(refSociale: string) {
    try {
      await navigator.clipboard.writeText(refSociale);
      setCopiedRefSociale(refSociale);
      window.setTimeout(
        () =>
          setCopiedRefSociale((current) =>
            current === refSociale ? null : current,
          ),
        1500,
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? `Impossible de copier la référence sociale : ${caught.message}`
          : "Impossible de copier la référence sociale.",
      );
    }
  }

  async function pasteRefSocialeFromClipboard() {
    setClipboardError(null);
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (value) searchFacture(value);
    } catch (caught: unknown) {
      setClipboardError(
        caught instanceof Error
          ? `Impossible de lire le presse-papiers : ${caught.message}`
          : "Impossible de lire le presse-papiers.",
      );
    }
  }

  function buildLineBody(): CreateFactureLineBody | UpdateFactureLineBody {
    return {
      libelle: draft.libelle.trim(),
      dateActe: draft.dateActe,
      idp: draft.idp.trim(),
      acteId: Number(draft.acteId || acteFromLibelle?.id),
      montantActe: Number(draft.montantActe),
      montantDepassementActe: Number(draft.montantDepassementActe || 0),
      montantDepassementPlafond: Number(draft.montantDepassementPlafond || 0),
      ...(draft.numPec ? { numPec: Number(draft.numPec) } : {}),
      refPaie: draft.refPaie.trim() || null,
      moisAffectation: `${draft.moisAffectation.slice(0, 7)}-01`,
      ...(draft.observationDepassement.trim()
        ? { observationDepassement: draft.observationDepassement.trim() }
        : {}),
    } as CreateFactureLineBody;
  }
  function openClotureConfirmation() {
    if (!selectedFacture) return;
    const moisAffectation = lines
      .find((line) => line.facture.id === selectedFacture.id)
      ?.moisAffectation?.slice(0, 7);
    setClotureMois(moisAffectation ?? clotureMois);
    setClotureError(null);
    setClotureConfirmationOpen(true);
  }
  async function confirmCloture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFacture) return;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(clotureMois)) {
      setClotureError("Sélectionnez un mois de retenue valide.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setClotureError(null);
    try {
      await cloturerFacture(
        selectedFacture.id,
        clotureMois,
        new Date().toISOString().slice(0, 10),
      );
      setClotureConfirmationOpen(false);
      await loadFacturesAndActes();
      await loadLines(selectedFacture.id);
    } catch (caught: unknown) {
      const message =
        caught instanceof Error ? caught.message : "La clôture a échoué.";
      setError(message);
      setClotureError(message);
    } finally {
      setIsSaving(false);
    }
  }
  function validateDraft(): string | null {
    if (!activeFactureId) return "Sélectionnez une facture globale.";
    if (
      !draft.libelle.trim() ||
      !draft.idp.trim() ||
      !draft.dateActe ||
      (!draft.acteId && !acteFromLibelle)
    )
      return "Libellé, date, IDP et acte sont obligatoires. Le libellé doit correspondre à un acte existant.";
    if (
      !Number.isFinite(Number(draft.montantActe)) ||
      Number(draft.montantActe) < 0
    )
      return "Le montant de l’acte doit être un nombre positif ou nul.";
    return null;
  }
  async function saveLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const body = buildLineBody();
      if (activeFactureId === null)
        throw new Error("Sélectionnez une facture globale.");
      if (editingLineId === null)
        await createFactureLine(activeFactureId, body as CreateFactureLineBody);
      else
        await updateFactureLine(
          activeFactureId,
          editingLineId,
          body as UpdateFactureLineBody,
        );
      cancelEditing();
      await loadLines();
      await loadFacturesAndActes();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "La ligne n’a pas pu être enregistrée.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  async function removeLine(line: LigneAffichee) {
    if (!window.confirm("Supprimer cette ligne de facture ?")) return;
    try {
      await deleteFactureLine(line.facture.id, line.id);
      if (editingLineId === line.id) cancelEditing();
      await loadLines();
      await loadFacturesAndActes();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "La ligne n’a pas pu être supprimée.",
      );
    }
  }

  const fieldsDisabled =
    selectedFacture === null ||
    isSaving ||
    Boolean(selectedFacture.dateCloture);
  const formFieldsDisabled =
    formFacture === null || isSaving || Boolean(formFacture.dateCloture);
  const activeFactureId =
    editingFactureId ?? (selectedFactureId ? Number(selectedFactureId) : null);
  const canEditDisplayedLines = selectedFacture?.dateCloture == null;
  const columns: Column<LigneAffichee>[] = [
    {
      key: "moisAffectation",
      label: "Mois d’affectation",
      className: "min-w-[145px]",
      render: (line) =>
        line.moisAffectation ? dateOnly(line.moisAffectation) : "—",
    },
    {
      key: "refPaie",
      label: "Ref paie",
      className: "min-w-[150px]",
      render: (line) => line.refPaie ?? "—",
    },
    {
      key: "dateSaisie",
      label: "Date saisie",
      className: "min-w-[120px]",
      render: (line) => dateOnly(line.dateSaisie),
    },
    {
      key: "refSociale",
      label: "Ref social",
      className: "min-w-[150px]",
      render: (line) => (
        <span className="inline-flex items-center gap-1">
          <span className="font-mono text-xs">{line.facture.refSociale}</span>
          <button
            type="button"
            className="btn-ghost p-1"
            title={
              copiedRefSociale === line.facture.refSociale
                ? "Copié"
                : "Copier la référence sociale"
            }
            aria-label={`Copier la référence sociale ${line.facture.refSociale}`}
            onClick={() => void copyRefSociale(line.facture.refSociale)}
          >
            <Copy size={14} />
          </button>
        </span>
      ),
    },
    {
      key: "numFacture",
      label: "Num facture",
      className: "min-w-[145px]",
      render: (line) => line.facture.numFacture,
    },
    {
      key: "dateFacture",
      label: "Date facture",
      className: "min-w-[120px]",
      render: (line) => dateOnly(line.facture.dateFacture),
    },
    {
      key: "prestataire",
      label: "Nom de l’établissement",
      className: "min-w-[220px] max-w-[260px]",
      wrap: true,
      render: (line) => line.facture.prestataire.nom,
    },
    {
      key: "idp",
      label: "IDP",
      className: "min-w-[110px]",
      render: (line) => line.idp,
    },
    {
      key: "beneficiaire",
      label: "Nom et prénom bénéficiaire",
      className: "min-w-[220px]",
      render: (line) => line.nomPrenomBeneficiaire,
    },
    {
      key: "codeFam",
      label: "Code fam",
      className: "min-w-[95px]",
      render: (line) => line.codeFam ?? "—",
    },
    {
      key: "obsIdp",
      label: "Obs IDP",
      className: "min-w-[130px]",
      render: (line) => line.obsIdp ?? "—",
    },
    {
      key: "im",
      label: "IM",
      className: "min-w-[90px]",
      render: (line) => line.im ?? "—",
    },
    {
      key: "agent",
      label: "Nom et prénom agent",
      className: "min-w-[220px]",
      render: (line) => line.nomPrenomAgent ?? "—",
    },
    {
      key: "direction",
      label: "Code direction",
      className: "min-w-[120px]",
      render: (line) => line.codeDirection ?? "—",
    },
    {
      key: "service",
      label: "Code service / agence",
      className: "min-w-[160px]",
      render: () => "—",
    },
    {
      key: "acte",
      label: "Code acte",
      className: "min-w-[110px]",
      render: (line) => line.acte.code,
    },
    {
      key: "libelle",
      label: "Acte / prestation",
      className: "min-w-[220px] max-w-[280px]",
      wrap: true,
      render: (line) => line.libelle,
    },
    {
      key: "categorieAgent",
      label: "Catégorie agent",
      className: "min-w-[180px]",
      render: (line) => line.categorieAgent ?? "—",
    },
    {
      key: "dateActe",
      label: "Date de l’acte",
      className: "min-w-[120px]",
      render: (line) => dateOnly(line.dateActe),
    },
    {
      key: "numPec",
      label: "Num PEC",
      className: "min-w-[100px]",
      render: (line) => line.numPec ?? "—",
    },
    {
      key: "montantActe",
      label: "Montant acte",
      className: "min-w-[135px] text-right",
      render: (line) => formatMoney(line.montantActe),
    },
    {
      key: "montantCemIntegral",
      label: "100% CEM",
      className: "min-w-[135px] text-right",
      render: (line) => formatMoney(line.montantCemIntegral),
    },
    {
      key: "montantDepassement",
      label: "Dépassement",
      className: "min-w-[135px] text-right",
      render: (line) => formatMoney(line.montantDepassement),
    },
    {
      key: "observationDepassement",
      label: "Obs dépassement",
      className: "min-w-[180px] max-w-[240px]",
      wrap: true,
      render: (line) => line.observationDepassement ?? "—",
    },
    {
      key: "montantCem",
      label: "80% CEM",
      className: "min-w-[135px] text-right",
      render: (line) => formatMoney(line.montantCem),
    },
    {
      key: "montantAgent",
      label: "20% Agent",
      className: "min-w-[135px] text-right",
      render: (line) => formatMoney(line.montantAgent),
    },
    {
      key: "totalChargeAgent",
      label: "Total à la charge de l’agent",
      className: "min-w-[170px] text-right",
      render: (line) => formatMoney(line.totalChargeAgent),
    },
  ];

  const rapprochementCourant =
    selectedFacture && rapprochement?.factureId === selectedFacture.id
      ? rapprochement
      : null;
  const rapprochementFactureAffichee =
    selectedFacture ?? rapprochementFerme?.facture ?? null;
  const rapprochementAffiche =
    rapprochementCourant ??
    (rapprochementFerme &&
    rapprochementFerme.facture.id === rapprochementFactureAffichee?.id
      ? rapprochementFerme.rapprochement
      : null);
  const partsAgentT6 = rapprochementAffiche?.partsAgentT6;
  const partAgentConcordante = compareAmounts(
    partsAgentT6?.montant20Agent,
    rapprochementFactureAffichee?.montant20Agent,
  );
  const chargeAgentConcordante = compareAmounts(
    partsAgentT6?.totalChargeAgent,
    rapprochementFactureAffichee?.totalChargeAgent,
  );
  const agentConcordances = [partAgentConcordante, chargeAgentConcordante];
  const statutRapprochementAffiche =
    rapprochementAffiche?.statut === "CONFORME"
      ? agentConcordances.includes(false)
        ? "ECART"
        : agentConcordances.includes(null)
          ? "INCOMPLET"
          : "CONFORME"
      : rapprochementAffiche?.statut;
  const rapprochementStatusLabel: Record<StatutRapprochement, string> = {
    CONFORME: "Conforme",
    ECART: "Écart détecté",
    INCOMPLET: "Incomplet",
    CALCUL: "Calcul en cours",
    ERREUR: "Indisponible",
  };
  const rapprochementItems: RapprochementItem[] = [
    ...(rapprochementAffiche?.controle
      ? [
          {
            label: "Montant des actes",
            t6: rapprochementAffiche.controle.sommes.montantActe,
            facture: rapprochementAffiche.controle.facture.montantTotal,
          },
          {
            label: "Part CEM à 100 %",
            t6: rapprochementAffiche.controle.sommes.montantCemIntegral,
            facture: rapprochementAffiche.controle.facture.total100Cem,
          },
          {
            label: "Dépassement",
            t6: rapprochementAffiche.controle.sommes.depassement,
            facture: rapprochementAffiche.controle.facture.totalDepassement,
          },
        ]
      : []),
    ...(partsAgentT6 && rapprochementFactureAffichee
      ? [
          {
            label: "Part agent (20 %)",
            t6: partsAgentT6.montant20Agent,
            facture: rapprochementFactureAffichee.montant20Agent,
            conformity: partAgentConcordante,
          },
          {
            label: "Charge totale de l’agent",
            t6: partsAgentT6.totalChargeAgent,
            facture: rapprochementFactureAffichee.totalChargeAgent,
            conformity: chargeAgentConcordante,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="T6 — Facture individuelle"
        description="Toutes les lignes des factures non clôturées, filtrables par référence sociale."
      />
      {error && (
        <ErrorBlock
          message={error}
          onRetry={() => void loadFacturesAndActes()}
        />
      )}
      {isLoading ? (
        <LoadingState message="Chargement des factures et des actes…" />
      ) : (
        <>
          <section
            className={`panel grid gap-4 p-4 ${
              selectedFacture
                ? "md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
                : ""
            } md:items-stretch`}
          >
            <div className="relative min-w-0">
              <label className="label" htmlFor="ref-sociale-search">
                Référence sociale de la facture globale
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Cliquez dans le champ pour coller depuis le presse-papiers.
              </p>
              <div className="relative mt-1">
                <input
                  id="ref-sociale-search"
                  className="field pr-10"
                  placeholder="Ex. F26/002"
                  value={refSocialeQuery}
                  onChange={(event) => {
                    setClipboardError(null);
                    searchFacture(event.target.value);
                  }}
                  onClick={() => void pasteRefSocialeFromClipboard()}
                  autoComplete="off"
                />
                {refSocialeQuery && (
                  <button
                    type="button"
                    className="btn-ghost absolute right-2 top-1/2 -translate-y-1/2 p-1"
                    title="Effacer la recherche"
                    aria-label="Effacer la recherche"
                    onClick={clearFactureSelection}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              {factureSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {factureSuggestions.map((facture) => (
                    <button
                      key={facture.id}
                      type="button"
                      className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-red-50"
                      onClick={() => selectFacture(facture)}
                    >
                      <span className="font-bold text-slate-900">
                        {facture.refSociale}
                      </span>
                      <span className="ml-2 text-slate-500">
                        {facture.numFacture} — {facture.prestataire.nom}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {refSocialeQuery.trim() &&
                !selectedFactureId &&
                factureSuggestions.length === 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Aucune facture trouvée pour cette référence sociale.
                  </p>
                )}
              {clipboardError && (
                <p className="mt-2 text-xs text-red-700" role="alert">
                  {clipboardError}
                </p>
              )}
            </div>
            {selectedFacture ? (
              <div className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div>
                  <div className="font-bold text-slate-900">
                    {selectedFacture.prestataire.nom}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {selectedFacture.refSociale} · {selectedFacture.numFacture}
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Statut facture : {selectedFacture.statut}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary w-full justify-center"
                  onClick={openClotureConfirmation}
                  disabled={fieldsDisabled}
                >
                  <LockKeyhole size={16} />{" "}
                  {selectedFacture.dateCloture
                    ? "Facture clôturée"
                    : "Clôturer définitivement"}
                </button>
              </div>
            ) : null}
          </section>
          <div
            className={`rapprochement-drawer ${
              selectedFacture && rapprochementCourant ? "is-open" : ""
            }`}
          >
            <div className="rapprochement-drawer-inner">
              {rapprochementFactureAffichee && rapprochementAffiche && (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div
                    className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${
                      statutRapprochementAffiche === "CONFORME"
                        ? "bg-emerald-50"
                        : statutRapprochementAffiche === "ECART" ||
                            statutRapprochementAffiche === "ERREUR"
                          ? "bg-red-50"
                          : statutRapprochementAffiche === "INCOMPLET"
                            ? "bg-amber-50"
                            : "bg-slate-50"
                    }`}
                  >
                    <div>
                      <h2 className="font-bold text-slate-900">
                        Rapprochement T6 / facture
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {rapprochementFactureAffichee.refSociale} ·{" "}
                        {rapprochementFactureAffichee.numFacture}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        statutRapprochementAffiche === "CONFORME"
                          ? "bg-emerald-100 text-emerald-800"
                          : statutRapprochementAffiche === "ECART" ||
                              statutRapprochementAffiche === "ERREUR"
                            ? "bg-red-100 text-red-800"
                            : statutRapprochementAffiche === "INCOMPLET"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {statutRapprochementAffiche &&
                        rapprochementStatusLabel[statutRapprochementAffiche]}
                    </span>
                  </div>
                  {rapprochementAffiche.statut === "CALCUL" && (
                    <p className="px-5 py-4 text-sm text-slate-500">
                      Calcul des totaux en cours…
                    </p>
                  )}
                  {rapprochementAffiche.statut === "ERREUR" && (
                    <p className="px-5 py-4 text-sm text-red-700">
                      Le contrôle des totaux n’a pas pu être chargé. Actualisez
                      la page pour réessayer.
                    </p>
                  )}
                  {statutRapprochementAffiche === "INCOMPLET" && (
                    <p className="px-5 py-4 text-sm text-amber-800">
                      Le rapprochement est incomplet : vérifiez les lignes T6 et
                      la présence des montants de facture, dont la part agent.
                    </p>
                  )}
                  {rapprochementItems.length > 0 && (
                    <div className="grid gap-3 p-4 md:grid-cols-3">
                      {rapprochementItems.map((item) => {
                        const ecart =
                          item.facture === null
                            ? null
                            : Number(item.t6) - Number(item.facture);
                        const partAgentStatus =
                          item.conformity !== undefined
                            ? item.conformity === null
                              ? "Non renseignée"
                              : item.conformity
                                ? "Conforme"
                                : "Écart détecté"
                            : null;
                        return (
                          <article
                            key={item.label}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <h3 className="text-sm font-bold text-slate-800">
                              {item.label}
                            </h3>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-slate-500">T6</p>
                                <p className="mt-1 font-semibold text-slate-900">
                                  {formatMoney(item.t6)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">
                                  Facture
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-slate-900">
                                    {formatMoney(item.facture)}
                                  </p>
                                  {partAgentStatus !== null && (
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                        item.conformity === true
                                          ? "bg-emerald-100 text-emerald-800"
                                          : item.conformity === false
                                            ? "bg-red-100 text-red-800"
                                            : "bg-amber-100 text-amber-800"
                                      }`}
                                    >
                                      {partAgentStatus}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-600">
                              Écart :{" "}
                              <span className="font-semibold text-slate-800">
                                {ecart === null ? "—" : formatMoney(ecart)}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
          <section className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-slate-900">
                Lignes T6
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={openNewLine}
                  disabled={fieldsDisabled}
                >
                  <Plus size={17} /> Ajouter une ligne
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  title="Actualiser"
                  onClick={() => void loadLines()}
                >
                  <RefreshCw size={17} /> Actualiser
                </button>
              </div>
            </div>
            <DataTable
              rows={lines}
              columns={columns}
              empty={
                selectedFacture
                  ? "Aucune ligne pour cette facture."
                  : "Aucune ligne pour les factures non clôturées."
              }
              onEdit={canEditDisplayedLines ? startEditing : undefined}
              onDelete={
                canEditDisplayedLines
                  ? (line) => void removeLine(line)
                  : undefined
              }
              pageSize={10}
            />
            {lines.length > 0 && (
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 sm:grid-cols-4">
                <span>Total actes : {formatMoney(lineTotals.montantActe)}</span>
                <span>
                  Total 100% CEM : {formatMoney(lineTotals.montantCemIntegral)}
                </span>
                <span>
                  Total 80% CEM : {formatMoney(lineTotals.montantCem)}
                </span>
                <span>
                  Total charge agent :{" "}
                  {formatMoney(lineTotals.totalChargeAgent)}
                </span>
              </div>
            )}
          </section>
          <Modal
            open={clotureConfirmationOpen}
            title="Confirmer la clôture"
            description={
              selectedFacture
                ? `Facture ${selectedFacture.refSociale} — ${selectedFacture.numFacture}`
                : undefined
            }
            onClose={() => {
              if (!isSaving) setClotureConfirmationOpen(false);
            }}
            width="max-w-lg"
          >
            <form className="space-y-5" onSubmit={confirmCloture}>
              <div className="flex gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <AlertTriangle size={18} />
                </span>
                <div>
                  <p className="font-bold text-amber-900">
                    Cette action est définitive
                  </p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    La facture sera clôturée et ses lignes ne pourront plus être
                    modifiées. Vérifiez le mois prévu pour la retenue.
                  </p>
                </div>
              </div>
              <label className="label">
                Mois prévu de retenue
                <input
                  type="month"
                  className="field mt-1"
                  value={clotureMois}
                  onChange={(event) => {
                    setClotureMois(event.target.value);
                    setClotureError(null);
                  }}
                  disabled={isSaving}
                  required
                />
              </label>
              {clotureError && (
                <p className="text-sm text-red-700" role="alert">
                  {clotureError}
                </p>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setClotureConfirmationOpen(false)}
                  disabled={isSaving}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSaving || !selectedFacture}
                >
                  <LockKeyhole size={16} />
                  {isSaving ? "Clôture en cours…" : "Confirmer la clôture"}
                </button>
              </div>
            </form>
          </Modal>
          <Modal
            open={lineFormOpen}
            title={
              editingLineId === null
                ? "Ajouter une ligne T6"
                : "Modifier la ligne T6"
            }
            description={
              formFacture
                ? `Facture ${formFacture.refSociale} — ${formFacture.prestataire.nom}`
                : undefined
            }
            onClose={cancelEditing}
            width="max-w-3xl"
          >
            <form className="space-y-4" onSubmit={saveLine}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="label">
                  N° IDP
                  <input
                    className="field mt-1"
                    value={draft.idp}
                    onChange={(event) => updateDraft("idp", event.target.value)}
                    disabled={formFieldsDisabled}
                  />
                </label>
                <label className="label">
                  Date acte
                  <input
                    type="date"
                    className="field mt-1"
                    value={draft.dateActe}
                    onChange={(event) =>
                      updateDraft("dateActe", event.target.value)
                    }
                    disabled={formFieldsDisabled}
                  />
                </label>
                <label className="label">
                  Acte
                  <select
                    className="field mt-1"
                    value={draft.acteId}
                    onChange={(event) => {
                      const acte = actes.find(
                        (item) => String(item.id) === event.target.value,
                      );
                      updateDraft("acteId", event.target.value);
                      if (acte && !draft.libelle)
                        updateDraft("libelle", acte.nomActe);
                    }}
                    disabled={formFieldsDisabled}
                  >
                    <option value="">Sélectionner</option>
                    {actes.map((acte) => (
                      <option key={acte.id} value={acte.id}>
                        {acte.code} — {acte.nomActe}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  N° PEC
                  <input
                    type="number"
                    min="1"
                    className="field mt-1"
                    value={draft.numPec}
                    onChange={(event) =>
                      updateDraft("numPec", event.target.value)
                    }
                    disabled={formFieldsDisabled}
                  />
                </label>
                <label className="label">
                  Ref paie (saisie manuelle)
                  <input
                    className="field mt-1"
                    value={draft.refPaie}
                    onChange={(event) =>
                      updateDraft("refPaie", event.target.value)
                    }
                    disabled={formFieldsDisabled}
                  />
                </label>
                <label className="label md:col-span-2">
                  Libellé
                  <input
                    className="field mt-1"
                    value={draft.libelle}
                    onChange={(event) =>
                      updateDraft("libelle", event.target.value)
                    }
                    disabled={formFieldsDisabled}
                  />
                </label>
                <label className="label">
                  Montant acte
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="field mt-1"
                    value={draft.montantActe}
                    onChange={(event) =>
                      updateDraft("montantActe", event.target.value)
                    }
                    disabled={formFieldsDisabled}
                  />
                </label>
                <label className="label">
                  Dépassement acte
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="field mt-1"
                    value={draft.montantDepassementActe}
                    onChange={(event) =>
                      updateDraft("montantDepassementActe", event.target.value)
                    }
                    disabled={formFieldsDisabled}
                  />
                </label>
                <label className="label">
                  Dépassement plafond
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="field mt-1"
                    value={draft.montantDepassementPlafond}
                    onChange={(event) =>
                      updateDraft(
                        "montantDepassementPlafond",
                        event.target.value,
                      )
                    }
                    disabled={formFieldsDisabled}
                  />
                </label>
                <label className="label md:col-span-2">
                  Observation
                  <textarea
                    className="field mt-1"
                    rows={2}
                    value={draft.observationDepassement}
                    onChange={(event) =>
                      updateDraft("observationDepassement", event.target.value)
                    }
                    disabled={formFieldsDisabled}
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={cancelEditing}
                >
                  <X size={16} /> Annuler
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={formFieldsDisabled || !selectedActe}
                >
                  {editingLineId === null ? "Ajouter la ligne" : "Enregistrer"}
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
}
