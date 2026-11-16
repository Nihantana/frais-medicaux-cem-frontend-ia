import { useCallback, useState } from "react";
import { listActes } from "../../../services/acte-api";
import { useAsyncLoader } from "../../../hooks/useAsyncLoader";

export type T5ActOption = {
	id: number;
	label: string;
};

export default function useT5Actes(categorieActeId: number | undefined) {
	const [actes, setActes] = useState<T5ActOption[]>([]);
	const [isLoading, setIsLoading] = useState(categorieActeId !== undefined);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async (isStale: () => boolean) => {
		if (categorieActeId === undefined) {
			setActes([]);
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		try {
			const response = await listActes();
			if (isStale()) return;
			setActes(
				response
					.filter((acte) => acte.categorieActeId === categorieActeId)
					.map((acte) => ({ id: acte.id, label: acte.nomActe })),
			);
			setError(null);
		} catch (reason) {
			if (isStale()) return;
			setActes([]);
			setError(reason instanceof Error ? reason.message : "Impossible de charger les actes de la catégorie.");
		} finally {
			if (!isStale()) setIsLoading(false);
		}
	}, [categorieActeId]);

	useAsyncLoader(load);

	const reload = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		await load(() => false);
	}, [load]);

	return { actes, isLoading, error, reload };
}
