import { useCallback, useState } from "react";
import {
	lancerControleFacture,
	obtenirControleFacture,
	type ControleFactureRapport,
} from "../services/verificationFactureAPI";

export default function useControleFactureIA(factureId: number | null) {
	const [rapport, setRapport] = useState<ControleFactureRapport | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const run = useCallback(async () => {
		if (factureId === null) return;
		setIsLoading(true);
		setError(null);
		try {
			setRapport(await lancerControleFacture(factureId));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Le contrôle IA a échoué.");
		} finally {
			setIsLoading(false);
		}
	}, [factureId]);

	const load = useCallback(async () => {
		if (factureId === null) return;
		setIsLoading(true);
		setError(null);
		try {
			setRapport(await obtenirControleFacture(factureId));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Le rapport IA est indisponible.");
		} finally {
			setIsLoading(false);
		}
	}, [factureId]);

	return { rapport, isLoading, error, run, load };
}
