import { useCallback, useEffect, useRef, useState } from "react";

export default function useScrollToAddInvoiceRow(isLoaded: boolean) {
	const containerRef = useRef<HTMLDivElement>(null);
	const addRowRef = useRef<HTMLTableRowElement>(null);
	const [isAddRowVisible, setIsAddRowVisible] = useState(false);

	useEffect(() => {
		if (!isLoaded || !isAddRowVisible || !containerRef.current) return;
		const row = addRowRef.current;
		if (!row) return;
		row.scrollIntoView({
			behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
				? "instant"
				: "smooth",
			block: "nearest",
			inline: "nearest",
		});
		const timeout = window.setTimeout(
			() => row.focus({ preventScroll: true }),
			window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280,
		);
		return () => window.clearTimeout(timeout);
	}, [isAddRowVisible, isLoaded]);

	const focusAddRow = useCallback(() => {
		setIsAddRowVisible(true);
	}, []);

	return { containerRef, addRowRef, isAddRowVisible, focusAddRow };
}
