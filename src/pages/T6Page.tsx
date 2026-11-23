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
  CircleCheck,
  CircleX,
  Copy,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { DataTable, type Column } from "../components/ui/DataTable";
import { ErrorBlock, LoadingState, Modal, PageHeader } from "../components/ui";
import { useAuth } from "../features/auth";
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
  type FactureLineWithConsommation,
  type FactureListResponse,
  type UpdateFactureLineBody,
} from "../features/invoice/services/serviceAPI";
import {
  rechercherMedicaments,
  verifierBeneficiaireT6,
  type ConsommationT6Input,
  type MedicamentSuggestion,
  type TypeConsommationT6,
} from "../features/consumption/services/consommations";
import { ApiError } from "../services/api";
import type { components } from "../api/schema";
import { formatDate } from "../utils/format";
import { notify } from "../utils/notify";

type Facture = FactureListResponse[number];
type Acte = components["schemas"]["ActeResponseDto"];
type Ligne = FactureLineWithConsommation;
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
type IdpValidationStatus = "idle" | "checking" | "valid" | "invalid" | "error";

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
  typeConsommation: "" | TypeConsommationT6;
  medicamentNom: string;
  medicamentSourceId: string;
  medicamentSource: "" | "BDPM" | "RXNORM";
  medicamentSubstanceActive: string;
  quantiteMedicament: string;
  posologieMedicament: string;
  typeVerre: string;
  monture: string;
  sphereOD: string;
  cylindreOD: string;
  axeOD: string;
  sphereOG: string;
  cylindreOG: string;
  axeOG: string;
  descriptionConsommation: string;
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
  typeConsommation: "",
  medicamentNom: "",
  medicamentSourceId: "",
  medicamentSource: "",
  medicamentSubstanceActive: "",
  quantiteMedicament: "1",
  posologieMedicament: "",
  typeVerre: "",
  monture: "",
  sphereOD: "",
  cylindreOD: "",
  axeOD: "",
  sphereOG: "",
  cylindreOG: "",
  axeOG: "",
  descriptionConsommation: "",
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
const dateOnly = (value: string): string => formatDate(value);
const incrementMonth = (value: string): string => {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 7);
};

export default function T6Page() {
  const { hasPermission } = useAuth();
  const canWriteT6 = hasPermission("t6.write");
  const canClosePayroll = hasPermission("payroll.close");
  const canReadReporting =
    hasPermission("reporting.read") || hasPermission("payroll.read");
  const [factures, setFactures] = useState<Facture[]>([]);
  const [actes, setActes] = useState<Acte[]>([]);
  const [selectedFactureId, setSelectedFactureId] = useState("");
  const [refSocialeQuery, setRefSocialeQuery] = useState("");
  const [selectedLineIds, setSelectedLineIds] = useState<Set<number>>(
    () => new Set(),
  );
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
  const [medicamentSuggestions, setMedicamentSuggestions] = useState<
    MedicamentSuggestion[]
  >([]);
  const [isSearchingMedicaments, setIsSearchingMedicaments] = useState(false);
  const [medicamentSearchError, setMedicamentSearchError] = useState<
    string | null
  >(null);
  const [depassementActeManuel, setDepassementActeManuel] = useState(false);
  const [depassementPlafondManuel, setDepassementPlafondManuel] =
    useState(false);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [clotureConfirmationOpen, setClotureConfirmationOpen] = useState(false);
  const [clotureError, setClotureError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idpValidationStatus, setIdpValidationStatus] =
    useState<IdpValidationStatus>("idle");
  const [idpValidationMessage, setIdpValidationMessage] = useState<
    string | null
  >(null);
  const [verifiedIdp, setVerifiedIdp] = useState<string | null>(null);
  const lineRequestId = useRef(0);
  const idpValidationRequestId = useRef(0);
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
        canReadReporting ? getPaieMois() : Promise.resolve([]),
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
          : "Impossible de charger les détails des frais médicaux.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [canReadReporting]);

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
  useEffect(() => {
    const idp = draft.idp.trim();
    if (!lineFormOpen || !idp) return;

    const requestId = ++idpValidationRequestId.current;
    const timer = window.setTimeout(async () => {
      try {
        const beneficiary = await verifierBeneficiaireT6(idp);
        if (requestId !== idpValidationRequestId.current) return;
        if (beneficiary.idp !== idp) {
          setIdpValidationStatus("invalid");
          setIdpValidationMessage(
            "L’IDP retourné ne correspond pas à celui saisi.",
          );
          return;
        }
        setVerifiedIdp(idp);
        setIdpValidationStatus("valid");
        setIdpValidationMessage(
          `Bénéficiaire trouvé : ${beneficiary.nomPrenomBeneficiaire}`,
        );
      } catch (caught: unknown) {
        if (requestId !== idpValidationRequestId.current) return;
        if (
          caught instanceof ApiError &&
          [400, 404].includes(caught.status ?? 0)
        ) {
          setIdpValidationStatus("invalid");
          setIdpValidationMessage(
            "Aucun bénéficiaire ne correspond à cet IDP.",
          );
          return;
        }
        setIdpValidationStatus("error");
        setIdpValidationMessage(
          caught instanceof Error
            ? `Vérification impossible : ${caught.message}`
            : "Vérification impossible. L’enregistrement est bloqué.",
        );
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      if (idpValidationRequestId.current === requestId) {
        idpValidationRequestId.current += 1;
      }
    };
  }, [draft.idp, lineFormOpen]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  async function searchMedicament() {
    setIsSearchingMedicaments(true);
    setMedicamentSearchError(null);
    try {
      const resultat = await rechercherMedicaments(draft.medicamentNom);
      setMedicamentSuggestions(resultat.suggestions);
      if (resultat.avertissement) {
        setMedicamentSearchError(resultat.avertissement);
      } else if (resultat.suggestions.length === 0) {
        setMedicamentSearchError(
          "Aucun médicament correspondant n’a été trouvé. Saisissez le nom figurant sur l’emballage; il sera ajouté au référentiel lors de l’enregistrement de la ligne T6.",
        );
      }
    } catch (caught: unknown) {
      setMedicamentSearchError(
        caught instanceof Error
          ? `${caught.message} Vous pouvez saisir le nom figurant sur l’emballage; il sera ajouté au référentiel lors de l’enregistrement de la ligne T6.`
          : "La recherche externe est indisponible. Vous pouvez saisir le nom figurant sur l’emballage; il sera ajouté au référentiel lors de l’enregistrement de la ligne T6.",
      );
      setMedicamentSuggestions([]);
    } finally {
      setIsSearchingMedicaments(false);
    }
  }
  function selectMedicament(suggestion: MedicamentSuggestion) {
    setDraft((current) => ({
      ...current,
      libelle: suggestion.nom,
      medicamentNom: suggestion.nom,
      medicamentSourceId: suggestion.sourceId ?? "",
      medicamentSource:
        suggestion.source === "BDPM" || suggestion.source === "RXNORM"
          ? suggestion.source
          : "",
      medicamentSubstanceActive: suggestion.substanceActive ?? "",
      posologieMedicament: "",
    }));
    setMedicamentSuggestions([]);
    setMedicamentSearchError(null);
  }
  function openNewLine() {
    idpValidationRequestId.current += 1;
    setIdpValidationStatus("idle");
    setIdpValidationMessage(null);
    setVerifiedIdp(null);
    setEditingLineId(null);
    setEditingFactureId(null);
    setDraft(emptyDraft());
    setMedicamentSuggestions([]);
    setMedicamentSearchError(null);
    setDepassementActeManuel(false);
    setDepassementPlafondManuel(false);
    setLineFormOpen(true);
  }
  function startEditing(line: LigneAffichee) {
    idpValidationRequestId.current += 1;
    setIdpValidationStatus(line.idp.trim() ? "checking" : "idle");
    setIdpValidationMessage(null);
    setVerifiedIdp(null);
    setEditingLineId(line.id);
    setEditingFactureId(line.facture.id);
    setDepassementActeManuel(false);
    setDepassementPlafondManuel(false);
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
        ? line.moisAffectation.slice(0, 7)
        : emptyDraft().moisAffectation.slice(0, 7),
      typeConsommation: line.consommation?.type ?? "",
      medicamentNom: line.consommation?.medicament?.nom ?? "",
      medicamentSourceId:
        line.consommation?.medicament?.sourceId ??
        line.consommation?.medicament?.rxcui ??
        "",
      medicamentSource:
        line.consommation?.medicament?.source === "BDPM" ||
        line.consommation?.medicament?.source === "RXNORM"
          ? line.consommation.medicament.source
          : "",
      medicamentSubstanceActive:
        line.consommation?.medicament?.substanceActive ?? "",
      quantiteMedicament: line.consommation?.quantite ?? "1",
      posologieMedicament: line.consommation?.posologie ?? "",
      typeVerre: line.consommation?.lunettes?.typeVerre ?? "",
      monture: line.consommation?.lunettes?.monture ?? "",
      sphereOD: line.consommation?.lunettes?.sphereOD ?? "",
      cylindreOD: line.consommation?.lunettes?.cylindreOD ?? "",
      axeOD: line.consommation?.lunettes?.axeOD?.toString() ?? "",
      sphereOG: line.consommation?.lunettes?.sphereOG ?? "",
      cylindreOG: line.consommation?.lunettes?.cylindreOG ?? "",
      axeOG: line.consommation?.lunettes?.axeOG?.toString() ?? "",
      descriptionConsommation: line.consommation?.description ?? "",
    });
    setMedicamentSuggestions([]);
    setMedicamentSearchError(null);
    setLineFormOpen(true);
  }
  function cancelEditing() {
    idpValidationRequestId.current += 1;
    setIdpValidationStatus("idle");
    setIdpValidationMessage(null);
    setVerifiedIdp(null);
    setEditingLineId(null);
    setEditingFactureId(null);
    setDraft(emptyDraft());
    setMedicamentSuggestions([]);
    setMedicamentSearchError(null);
    setDepassementActeManuel(false);
    setDepassementPlafondManuel(false);
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
    setSelectedLineIds(new Set());
    setRapprochement(null);
    cancelEditing();
  }
  function selectFacture(facture: Facture) {
    stopRapprochementClose();
    setRefSocialeQuery(facture.refSociale);
    setSelectedFactureId(String(facture.id));
    setSelectedLineIds(new Set());
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
      setSelectedLineIds(new Set());
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
    const moisAffectationMatch = /^([0-9]{4}-[0-9]{2})(?:-[0-9]{2})?/.exec(
      draft.moisAffectation,
    );
    const moisAffectation = moisAffectationMatch
      ? `${moisAffectationMatch[1]}-01`
      : `${draft.moisAffectation.slice(0, 7)}-01`;
    const nombreOptionnel = (valeur: string): number | undefined =>
      valeur.trim() === "" ? undefined : Number(valeur);
    let consommation: ConsommationT6Input | null = null;
    if (draft.typeConsommation === "MEDICAMENT") {
      consommation = {
        type: "MEDICAMENT",
        quantite: Number(draft.quantiteMedicament),
        ...(draft.posologieMedicament.trim()
          ? { posologie: draft.posologieMedicament.trim() }
          : {}),
        medicament: {
          nom: draft.medicamentNom.trim(),
          ...(draft.medicamentSourceId
            ? {
                sourceId: draft.medicamentSourceId,
                source: draft.medicamentSource || "BDPM",
              }
            : {}),
          ...(draft.medicamentSubstanceActive.trim()
            ? { substanceActive: draft.medicamentSubstanceActive.trim() }
            : {}),
        },
      };
    } else if (draft.typeConsommation === "LUNETTES") {
      consommation = {
        type: "LUNETTES",
        lunettes: {
          ...(draft.typeVerre.trim()
            ? { typeVerre: draft.typeVerre.trim() }
            : {}),
          ...(draft.monture.trim() ? { monture: draft.monture.trim() } : {}),
          ...(nombreOptionnel(draft.sphereOD) !== undefined
            ? { sphereOD: nombreOptionnel(draft.sphereOD) }
            : {}),
          ...(nombreOptionnel(draft.cylindreOD) !== undefined
            ? { cylindreOD: nombreOptionnel(draft.cylindreOD) }
            : {}),
          ...(nombreOptionnel(draft.axeOD) !== undefined
            ? { axeOD: nombreOptionnel(draft.axeOD) }
            : {}),
          ...(nombreOptionnel(draft.sphereOG) !== undefined
            ? { sphereOG: nombreOptionnel(draft.sphereOG) }
            : {}),
          ...(nombreOptionnel(draft.cylindreOG) !== undefined
            ? { cylindreOG: nombreOptionnel(draft.cylindreOG) }
            : {}),
          ...(nombreOptionnel(draft.axeOG) !== undefined
            ? { axeOG: nombreOptionnel(draft.axeOG) }
            : {}),
        },
      };
    } else if (draft.typeConsommation === "AUTRE") {
      consommation = {
        type: "AUTRE",
        description: draft.descriptionConsommation.trim(),
      };
    }
    return {
      libelle:
        draft.typeConsommation === "MEDICAMENT"
          ? draft.medicamentNom.trim()
          : draft.libelle.trim(),
      dateActe: draft.dateActe,
      idp: draft.idp.trim(),
      acteId: Number(draft.acteId || acteFromLibelle?.id),
      montantActe: Number(draft.montantActe),
      ...(depassementActeManuel
        ? { montantDepassementActe: Number(draft.montantDepassementActe || 0) }
        : {}),
      ...(depassementPlafondManuel
        ? {
            montantDepassementPlafond: Number(
              draft.montantDepassementPlafond || 0,
            ),
          }
        : {}),
      ...(draft.numPec ? { numPec: Number(draft.numPec) } : {}),
      refPaie: draft.refPaie.trim() || null,
      moisAffectation,
      ...(draft.observationDepassement.trim()
        ? { observationDepassement: draft.observationDepassement.trim() }
        : {}),
      consommation,
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
    const libelleValide =
      draft.typeConsommation === "MEDICAMENT"
        ? draft.medicamentNom.trim()
        : draft.libelle.trim();
    if (
      !libelleValide ||
      !draft.idp.trim() ||
      !draft.dateActe ||
      (!draft.acteId && !acteFromLibelle)
    )
      return "Le bénéficiaire, la date et l’acte sont obligatoires. Le libellé doit correspondre à un acte existant.";
    if (idpValidationStatus !== "valid" || verifiedIdp !== draft.idp.trim())
      return "Vérifiez qu’un bénéficiaire existe pour cet IDP avant l’enregistrement.";
    if (
      draft.typeConsommation === "MEDICAMENT" &&
      (!Number.isFinite(Number(draft.quantiteMedicament)) ||
        Number(draft.quantiteMedicament) <= 0)
    )
      return "Saisissez une quantité de médicament supérieure à zéro.";
    if (
      draft.typeConsommation === "LUNETTES" &&
      !draft.typeVerre.trim() &&
      !draft.sphereOD.trim() &&
      !draft.sphereOG.trim()
    )
      return "Saisissez le type de verre ou une correction pour les lunettes.";
    if (
      draft.typeConsommation === "AUTRE" &&
      !draft.descriptionConsommation.trim()
    )
      return "Saisissez la description de la consommation.";
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
      setSelectedLineIds((current) => {
        const next = new Set(current);
        next.delete(line.id);
        return next;
      });
      notify("Ligne T6 supprimée avec succès.");
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
  function toggleLineSelection(lineId: number) {
    setSelectedLineIds((current) => {
      const next = new Set(current);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }
  function toggleAllLineSelections() {
    if (!selectedFacture) return;
    const factureLineIds = lines
      .filter((line) => line.facture.id === selectedFacture.id)
      .map((line) => line.id);
    const shouldSelectAll = !factureLineIds.every((id) =>
      selectedLineIds.has(id),
    );
    setSelectedLineIds((current) => {
      const next = new Set(current);
      for (const id of factureLineIds) {
        if (shouldSelectAll) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }
  async function removeSelectedLines() {
    if (
      !selectedFacture ||
      !canWriteT6 ||
      selectedFacture.dateCloture ||
      selectedLineIds.size === 0
    ) {
      return;
    }

    const lignesSelectionnees = lines.filter(
      (line) =>
        line.facture.id === selectedFacture.id &&
        selectedLineIds.has(line.id),
    );
    if (lignesSelectionnees.length === 0) {
      setSelectedLineIds(new Set());
      return;
    }
    if (
      !window.confirm(
        `Supprimer ${lignesSelectionnees.length} ligne(s) de la référence sociale ${selectedFacture.refSociale} ? Cette action est définitive.`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    setError(null);
    const idsSupprimes = new Set<number>();
    const idsEnEchec = new Set<number>();
    const erreurs: string[] = [];
    try {
      for (const ligne of lignesSelectionnees) {
        try {
          await deleteFactureLine(ligne.facture.id, ligne.id);
          idsSupprimes.add(ligne.id);
        } catch (caught: unknown) {
          idsEnEchec.add(ligne.id);
          erreurs.push(
            caught instanceof Error
              ? caught.message
              : `La ligne ${ligne.id} n’a pas pu être supprimée.`,
          );
        }
      }

      setSelectedLineIds(idsEnEchec);
      if (editingLineId !== null && idsSupprimes.has(editingLineId)) {
        cancelEditing();
      }
      if (idsSupprimes.size > 0) {
        notify(
          `${idsSupprimes.size} ligne(s) T6 supprimée(s) avec succès.`,
        );
        await loadLines(selectedFacture.id);
        await loadFacturesAndActes();
      }
      if (erreurs.length > 0) {
        notify(
          `${erreurs.length} ligne(s) n’ont pas pu être supprimée(s). ${erreurs[0]}`,
          "error",
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  const fieldsDisabled =
    !canWriteT6 ||
    selectedFacture === null ||
    isSaving ||
    Boolean(selectedFacture.dateCloture);
  const formFieldsDisabled =
    formFacture === null || isSaving || Boolean(formFacture.dateCloture);
  const activeFactureId =
    editingFactureId ?? (selectedFactureId ? Number(selectedFactureId) : null);
  const canEditDisplayedLines =
    canWriteT6 && selectedFacture?.dateCloture == null;
  const canMutateDisplayedLines = canEditDisplayedLines && !isSaving;
  const canSelectDisplayedLines =
    canEditDisplayedLines &&
    Boolean(refSocialeQuery.trim()) &&
    lines.length > 0;
  const allDisplayedLinesSelected =
    lines.length > 0 &&
    lines.every(
      (line) =>
        line.facture.id === selectedFacture?.id &&
        selectedLineIds.has(line.id),
    );
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
      label: "Identifiant bénéficiaire",
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
      label: "Lien familial",
      className: "min-w-[95px]",
      render: (line) => line.codeFam ?? "—",
    },
    {
      key: "obsIdp",
      label: "Observation bénéficiaire",
      className: "min-w-[130px]",
      render: (line) => line.obsIdp ?? "—",
    },
    {
      key: "im",
      label: "Matricule agent",
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
      label: "Direction",
      className: "min-w-[120px]",
      render: (line) => line.codeDirection ?? "—",
    },
    {
      key: "service",
      label: "Service / agence",
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
      render: (line) => (
        <div>
          <div>{line.libelle}</div>
          {line.consommation?.posologie && (
            <div className="mt-1 text-xs text-slate-500">
              Posologie : {line.consommation.posologie}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "categorieAgent",
      label: "Catégorie agent",
      className: "min-w-[180px]",
      render: (line) => line.categorieAgent ?? "—",
    },
    {
      key: "agentType",
      label: "Statut agent",
      className: "min-w-[150px]",
      render: (line) =>
        line.agentType === "AGENT_RETRAITE"
          ? "Retraité"
          : line.agentType === "AGENT_ACTIF"
            ? "Actif"
            : "—",
    },
    {
      key: "dateActe",
      label: "Date de l’acte",
      className: "min-w-[120px]",
      render: (line) => dateOnly(line.dateActe),
    },
    {
      key: "numPec",
      label: "N° prise en charge",
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
      label: "Part CEM",
      className: "min-w-[135px] text-right",
      render: (line) => formatMoney(line.montantCem),
    },
    {
      key: "montantAgent",
      label: "Part agent",
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
        title="Détail des frais médicaux"
        description="Consultez et mettez à jour les frais rattachés aux factures non clôturées."
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
                {canClosePayroll && (
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
                )}
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
                        Comparaison des frais saisis et de la facture
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
                      La comparaison est incomplète : vérifiez les lignes de
                      frais et la présence des montants de facture, dont la part
                      agent.
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
                                <p className="text-xs text-slate-500">
                                  Frais saisis
                                </p>
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
                Détail des frais
              </h2>
              <div className="flex gap-2">
                {canSelectDisplayedLines && (
                  <button
                    type="button"
                    className="btn-secondary text-red-700"
                    onClick={() => void removeSelectedLines()}
                    disabled={isSaving || selectedLineIds.size === 0}
                  >
                    <Trash2 size={16} />
                    Supprimer la sélection ({selectedLineIds.size})
                  </button>
                )}
                {canWriteT6 && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={openNewLine}
                    disabled={fieldsDisabled}
                  >
                    <Plus size={17} /> Ajouter une ligne
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  title="Actualiser"
                  onClick={() => void loadLines()}
                  disabled={isSaving}
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
              onEdit={canMutateDisplayedLines ? startEditing : undefined}
              onDelete={
                canMutateDisplayedLines
                  ? (line) => void removeLine(line)
                  : undefined
              }
              selected={canSelectDisplayedLines ? selectedLineIds : undefined}
              onToggleRow={
                canSelectDisplayedLines ? toggleLineSelection : undefined
              }
              onToggleAll={
                canSelectDisplayedLines ? toggleAllLineSelections : undefined
              }
              allSelected={allDisplayedLinesSelected}
              selectionDisabled={isSaving}
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
                ? "Ajouter une ligne de frais"
                : "Modifier le détail des frais"
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
                  Identifiant du bénéficiaire
                  <span className="relative mt-1 block">
                    <input
                      className={`field pr-10 ${
                        idpValidationStatus === "valid"
                          ? "border-emerald-500"
                          : idpValidationStatus === "invalid" ||
                              idpValidationStatus === "error"
                            ? "border-red-500"
                            : ""
                      }`}
                      value={draft.idp}
                      onChange={(event) => {
                        idpValidationRequestId.current += 1;
                        setVerifiedIdp(null);
                        setIdpValidationMessage(null);
                        setIdpValidationStatus(
                          event.target.value.trim() ? "checking" : "idle",
                        );
                        updateDraft("idp", event.target.value);
                      }}
                      disabled={formFieldsDisabled}
                      aria-invalid={
                        idpValidationStatus === "invalid" ||
                        idpValidationStatus === "error"
                      }
                      aria-describedby="t6-idp-validation-message"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      {idpValidationStatus === "checking" && (
                        <LoaderCircle
                          size={18}
                          className="animate-spin text-slate-400"
                          aria-hidden="true"
                        />
                      )}
                      {idpValidationStatus === "valid" && (
                        <CircleCheck
                          size={18}
                          className="text-emerald-600"
                          aria-hidden="true"
                        />
                      )}
                      {(idpValidationStatus === "invalid" ||
                        idpValidationStatus === "error") && (
                        <CircleX
                          size={18}
                          className="text-red-600"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  </span>
                  {idpValidationStatus !== "idle" && idpValidationMessage && (
                    <span
                      id="t6-idp-validation-message"
                      className={`mt-1 block text-xs ${
                        idpValidationStatus === "valid"
                          ? "text-emerald-700"
                          : idpValidationStatus === "checking"
                            ? "text-slate-500"
                            : "text-red-700"
                      }`}
                      role="status"
                    >
                      {idpValidationMessage}
                    </span>
                  )}
                  {idpValidationStatus === "checking" && (
                    <span
                      id="t6-idp-validation-message"
                      className="mt-1 block text-xs text-slate-500"
                      role="status"
                    >
                      Vérification de l’IDP…
                    </span>
                  )}
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
                  Suivi complémentaire
                  <select
                    className="field mt-1"
                    value={draft.typeConsommation}
                    onChange={(event) =>
                      updateDraft(
                        "typeConsommation",
                        event.target.value as Draft["typeConsommation"],
                      )
                    }
                    disabled={formFieldsDisabled}
                  >
                    <option value="">Aucun</option>
                    <option value="MEDICAMENT">Médicament</option>
                    <option value="LUNETTES">Lunettes</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                </label>
                {draft.typeConsommation === "MEDICAMENT" && (
                  <>
                    <div className="label md:col-span-2">
                      Médicament
                      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                        <input
                          className="field"
                          value={draft.medicamentNom}
                          onChange={(event) => {
                            const nom = event.target.value;
                            setDraft((current) => ({
                              ...current,
                              medicamentNom: nom,
                              medicamentSourceId: "",
                              medicamentSource: "",
                              medicamentSubstanceActive: "",
                              posologieMedicament: "",
                              libelle: nom,
                            }));
                            setMedicamentSuggestions([]);
                            setMedicamentSearchError(null);
                          }}
                          disabled={formFieldsDisabled}
                          placeholder="Rechercher par nom ou substance active"
                        />
                        <button
                          type="button"
                          className="btn-secondary shrink-0"
                          onClick={() => void searchMedicament()}
                          disabled={
                            formFieldsDisabled ||
                            isSearchingMedicaments ||
                            draft.medicamentNom.trim().length < 2
                          }
                        >
                          {isSearchingMedicaments ? "Recherche…" : "Rechercher"}
                        </button>
                      </div>
                      {draft.medicamentSource === "BDPM" &&
                      draft.medicamentSourceId ? (
                        <p className="mt-1 text-xs text-emerald-700">
                          Référence BDPM sélectionnée (CIS{" "}
                          {draft.medicamentSourceId})
                        </p>
                      ) : draft.medicamentSource === "RXNORM" &&
                        draft.medicamentSourceId ? (
                        <p className="mt-1 text-xs text-emerald-700">
                          Ancienne référence RxNorm conservée
                        </p>
                      ) : draft.medicamentNom ? (
                        <p className="mt-1 text-xs text-amber-700">
                          Produit saisi manuellement — il sera enregistré dans
                          le référentiel local avec le statut « à vérifier ».
                        </p>
                      ) : null}
                      {medicamentSearchError && (
                        <p
                          className="mt-1 text-xs text-amber-700"
                          role="status"
                        >
                          {medicamentSearchError}
                        </p>
                      )}
                      {medicamentSuggestions.length > 0 && (
                        <ul className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white">
                          {medicamentSuggestions.map((suggestion) => (
                            <li
                              key={`${suggestion.source}:${suggestion.sourceId ?? suggestion.nom}`}
                            >
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                                onClick={() => selectMedicament(suggestion)}
                              >
                                <span className="block">{suggestion.nom}</span>
                                <span className="block text-xs text-slate-500">
                                  {suggestion.source === "BDPM" &&
                                  suggestion.sourceId
                                    ? `BDPM · CIS ${suggestion.sourceId}`
                                    : "Déjà enregistré localement"}
                                  {suggestion.substanceActive
                                    ? ` · ${suggestion.substanceActive}`
                                    : ""}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <label className="label">
                      Quantité
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="field mt-1"
                        value={draft.quantiteMedicament}
                        onChange={(event) =>
                          updateDraft("quantiteMedicament", event.target.value)
                        }
                        disabled={formFieldsDisabled}
                      />
                    </label>
                    <label className="label md:col-span-2">
                      Posologie
                      <textarea
                        className="field mt-1"
                        rows={2}
                        maxLength={1000}
                        value={draft.posologieMedicament}
                        onChange={(event) =>
                          updateDraft("posologieMedicament", event.target.value)
                        }
                        disabled={formFieldsDisabled}
                        placeholder="Ex. 1 comprimé matin et soir pendant 5 jours"
                      />
                    </label>
                  </>
                )}
                {draft.typeConsommation === "LUNETTES" && (
                  <>
                    <label className="label">
                      Type de verre
                      <input
                        className="field mt-1"
                        value={draft.typeVerre}
                        onChange={(event) =>
                          updateDraft("typeVerre", event.target.value)
                        }
                        disabled={formFieldsDisabled}
                      />
                    </label>
                    <label className="label">
                      Monture
                      <input
                        className="field mt-1"
                        value={draft.monture}
                        onChange={(event) =>
                          updateDraft("monture", event.target.value)
                        }
                        disabled={formFieldsDisabled}
                      />
                    </label>
                    <p className="label md:col-span-2">Œil droit (OD)</p>
                    <label className="label">
                      Sphère OD
                      <input
                        type="number"
                        step="0.25"
                        className="field mt-1"
                        value={draft.sphereOD}
                        onChange={(event) =>
                          updateDraft("sphereOD", event.target.value)
                        }
                        disabled={formFieldsDisabled}
                      />
                    </label>
                    <label className="label">
                      Cylindre OD
                      <input
                        type="number"
                        step="0.25"
                        className="field mt-1"
                        value={draft.cylindreOD}
                        onChange={(event) =>
                          updateDraft("cylindreOD", event.target.value)
                        }
                        disabled={formFieldsDisabled}
                      />
                    </label>
                    <label className="label">
                      Axe OD (0–180)
                      <input
                        type="number"
                        min="0"
                        max="180"
                        step="1"
                        className="field mt-1"
                        value={draft.axeOD}
                        onChange={(event) =>
                          updateDraft("axeOD", event.target.value)
                        }
                        disabled={formFieldsDisabled}
                      />
                    </label>
                    <p className="label md:col-span-2">Œil gauche (OG)</p>
                    <label className="label">
                      Sphère OG
                      <input
                        type="number"
                        step="0.25"
                        className="field mt-1"
                        value={draft.sphereOG}
                        onChange={(event) =>
                          updateDraft("sphereOG", event.target.value)
                        }
                        disabled={formFieldsDisabled}
                      />
                    </label>
                    <label className="label">
                      Cylindre OG
                      <input
                        type="number"
                        step="0.25"
                        className="field mt-1"
                        value={draft.cylindreOG}
                        onChange={(event) =>
                          updateDraft("cylindreOG", event.target.value)
                        }
                        disabled={formFieldsDisabled}
                      />
                    </label>
                    <label className="label">
                      Axe OG (0–180)
                      <input
                        type="number"
                        min="0"
                        max="180"
                        step="1"
                        className="field mt-1"
                        value={draft.axeOG}
                        onChange={(event) =>
                          updateDraft("axeOG", event.target.value)
                        }
                        disabled={formFieldsDisabled}
                      />
                    </label>
                  </>
                )}
                {draft.typeConsommation === "AUTRE" && (
                  <label className="label md:col-span-2">
                    Description de la consommation
                    <textarea
                      className="field mt-1"
                      rows={2}
                      value={draft.descriptionConsommation}
                      onChange={(event) =>
                        updateDraft(
                          "descriptionConsommation",
                          event.target.value,
                        )
                      }
                      disabled={formFieldsDisabled}
                    />
                  </label>
                )}
                <label className="label">
                  N° de prise en charge
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
                    onChange={(event) => {
                      setDepassementActeManuel(true);
                      updateDraft("montantDepassementActe", event.target.value);
                    }}
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
                    onChange={(event) => {
                      setDepassementPlafondManuel(true);
                      updateDraft(
                        "montantDepassementPlafond",
                        event.target.value,
                      );
                    }}
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
                  disabled={
                    formFieldsDisabled ||
                    !selectedActe ||
                    idpValidationStatus !== "valid" ||
                    verifiedIdp !== draft.idp.trim()
                  }
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
