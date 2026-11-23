import type { FacturePaths } from "../../../api/domains/facture";
import { apiService } from "../../../services/api";
import {
  type BodyOf,
  fillPath,
  type QueryOf,
  type ResponseOf,
} from "../../../services/api-contract";
import type {
  ConsommationT6Detail,
  ConsommationT6Input,
} from "../../consumption/services/consommations";

const ROUTES = {
  list: "/factures",
  detail: "/factures/{id}",
  transitions: "/factures/{id}/transitions",
  lines: "/factures/{id}/lignes",
  controleTotaux: "/factures/{id}/controle-totaux",
  line: "/factures/{id}/lignes/{ligneId}",
  attachments: "/factures/{id}/pieces-jointes",
  attachment: "/factures/{id}/pieces-jointes/{pieceId}",
} as const satisfies Record<string, keyof FacturePaths>;

export type FactureListQuery = QueryOf<FacturePaths, typeof ROUTES.list, "get">;

export type FactureListResponse = ResponseOf<
  FacturePaths,
  typeof ROUTES.list,
  "get"
>;
export type FactureDetailResponse = ResponseOf<
  FacturePaths,
  typeof ROUTES.detail,
  "get"
>;
export type CreateFactureBody = BodyOf<
  FacturePaths,
  typeof ROUTES.list,
  "post"
>;
export type CreateFactureResponse = ResponseOf<
  FacturePaths,
  typeof ROUTES.list,
  "post"
>;
export type UpdateFactureBody = BodyOf<
  FacturePaths,
  typeof ROUTES.detail,
  "patch"
> & {
  dateRetourAction?: string;
};
export type UpdateFactureResponse = ResponseOf<
  FacturePaths,
  typeof ROUTES.detail,
  "patch"
>;
export type FactureLinesResponse = ResponseOf<
  FacturePaths,
  typeof ROUTES.lines,
  "get"
>;
export type FactureControleTotauxResponse = ResponseOf<
  FacturePaths,
  typeof ROUTES.controleTotaux,
  "get"
>;
export type CreateFactureLineBody = BodyOf<
  FacturePaths,
  typeof ROUTES.lines,
  "post"
> & { consommation?: ConsommationT6Input | null };
export type CreateFactureLineResponse = ResponseOf<
  FacturePaths,
  typeof ROUTES.lines,
  "post"
>;
export type UpdateFactureLineBody = BodyOf<
  FacturePaths,
  typeof ROUTES.line,
  "put"
> & { consommation?: ConsommationT6Input | null };
export type UpdateFactureLineResponse = ResponseOf<
  FacturePaths,
  typeof ROUTES.line,
  "put"
>;
export type FactureLineWithConsommation = Omit<
  FactureLinesResponse["lignes"][number],
  "consommation"
> & { consommation?: ConsommationT6Detail | null };
export type FactureAttachmentResponse = ResponseOf<
  FacturePaths,
  typeof ROUTES.attachments,
  "post"
>;
export type FactureWorkflowBody = BodyOf<
  FacturePaths,
  "/factures/{id}/statut",
  "patch"
>;
export type FactureWorkflowResponse = ResponseOf<
  FacturePaths,
  "/factures/{id}/statut",
  "patch"
>;
export type FactureTransitionsResponse = ResponseOf<
  FacturePaths,
  typeof ROUTES.transitions,
  "get"
>;

export const getFactures = (
  query?: FactureListQuery,
): Promise<FactureListResponse> =>
  apiService.get<FactureListResponse>(ROUTES.list, { params: query });

export const getFacture = (id: number): Promise<FactureDetailResponse> =>
  apiService.get<FactureDetailResponse>(fillPath(ROUTES.detail, { id }));

export const getFactureTransitions = (
  id: number,
): Promise<FactureTransitionsResponse> =>
  apiService.get<FactureTransitionsResponse>(
    fillPath(ROUTES.transitions, { id }),
  );

export const createFacture = (
  body: CreateFactureBody,
): Promise<CreateFactureResponse> =>
  apiService.post<CreateFactureResponse>(ROUTES.list, body);

export const updateFacture = (
  id: number,
  body: UpdateFactureBody,
): Promise<UpdateFactureResponse> =>
  apiService.patch<UpdateFactureResponse>(
    fillPath(ROUTES.detail, { id }),
    body,
  );

export const getFactureLines = (id: number): Promise<FactureLinesResponse> =>
  apiService.get<FactureLinesResponse>(fillPath(ROUTES.lines, { id }));

export const getFactureControleTotaux = (
  id: number,
): Promise<FactureControleTotauxResponse> =>
  apiService.get<FactureControleTotauxResponse>(
    fillPath(ROUTES.controleTotaux, { id }),
  );

export const createFactureLine = (
  id: number,
  body: CreateFactureLineBody,
): Promise<CreateFactureLineResponse> =>
  apiService.post<CreateFactureLineResponse>(
    fillPath(ROUTES.lines, { id }),
    body,
  );

export const updateFactureLine = (
  id: number,
  ligneId: number,
  body: UpdateFactureLineBody,
): Promise<UpdateFactureLineResponse> =>
  apiService.put<UpdateFactureLineResponse>(
    fillPath(ROUTES.line, { id, ligneId }),
    body,
  );

export const deleteFactureLine = (id: number, ligneId: number): Promise<void> =>
  apiService.delete<void>(fillPath(ROUTES.line, { id, ligneId }));

export const updateFactureStatut = (
  id: number,
  body: FactureWorkflowBody,
): Promise<FactureWorkflowResponse> =>
  apiService.patch<FactureWorkflowResponse>(
    fillPath("/factures/{id}/statut", { id }),
    body,
  );

/**
 * Uploads one file as `multipart/form-data`.
 *
 * `Content-Type` is intentionally not set: axios adds the multipart boundary.
 */
export const uploadFactureAttachment = (
  id: number,
  file: File,
): Promise<FactureAttachmentResponse> => {
  const body = new FormData();
  body.append("fichier", file);
  return apiService.post<FactureAttachmentResponse>(
    fillPath(ROUTES.attachments, { id }),
    body,
  );
};

export const deleteFactureAttachment = (
  id: number,
  pieceId: number,
): Promise<void> =>
  apiService.delete<void>(fillPath(ROUTES.attachment, { id, pieceId }));

export const downloadFactureAttachment = (
  id: number,
  pieceId: number,
): Promise<Blob> =>
  apiService.get<Blob>(fillPath(ROUTES.attachment, { id, pieceId }), {
    responseType: "blob",
  });
