import type { T5ParAnRow } from "../features/invoice/types/t5ParAn";
import type { T5ParAnParActeRow } from "../features/invoice/types/t5ParAnParActe";
import type { T5ParSeanceRow } from "../features/invoice/types/t5ParSeance";

export type IdpLookupBeneficiaryInfo = {
	idp: string;
	nomPrenom: string;
	codeFam: string;
	observationIdp: string | null;
};

export type IdpLookupAgentInfo = {
	nomPrenom: string | null;
	matricule: string | null;
	direction: string | null;
	agenceService: string | null;
};

export type IdpLookupResult = {
	beneficiary: IdpLookupBeneficiaryInfo;
	agent: IdpLookupAgentInfo;
	t5Data: {
		parAn: T5ParAnRow[];
		parAnParActe: T5ParAnParActeRow[];
		parSeance: T5ParSeanceRow[];
	};
};
