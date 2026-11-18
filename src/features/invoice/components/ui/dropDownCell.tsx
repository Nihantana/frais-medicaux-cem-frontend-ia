import {
  ArrowUpRight,
  ChevronDown,
  CirclePlus,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ROUTES } from "../../../../constants/routes";
import { fillPath } from "../../../../services/api-contract";
import { TypeContrainte, type DropdownOption } from "../../types/dropDown";

type PopoverPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const POPOVER_WIDTH = 320;
const POPOVER_MAX_HEIGHT = 320;
const VIEWPORT_MARGIN = 12;

function calculatePopoverPosition(
  anchor: DOMRect,
  panelHeight: number,
): PopoverPosition {
  const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(
      anchor.left + (anchor.width - width) / 2,
      window.innerWidth - width - VIEWPORT_MARGIN,
    ),
  );
  const spaceBelow =
    window.innerHeight - anchor.bottom - VIEWPORT_MARGIN * 2;
  const spaceAbove = anchor.top - VIEWPORT_MARGIN * 2;
  const opensAbove =
    spaceBelow < Math.min(panelHeight, POPOVER_MAX_HEIGHT) &&
    spaceAbove > spaceBelow;
  const availableSpace = Math.max(
    80,
    opensAbove ? spaceAbove : spaceBelow,
  );
  const maxHeight = Math.min(POPOVER_MAX_HEIGHT, availableSpace);
  const visibleHeight = Math.min(panelHeight, maxHeight);
  const top = opensAbove
    ? Math.max(
        VIEWPORT_MARGIN,
        anchor.top - visibleHeight - VIEWPORT_MARGIN / 2,
      )
    : Math.min(
        anchor.bottom + VIEWPORT_MARGIN / 2,
        window.innerHeight - visibleHeight - VIEWPORT_MARGIN,
      );

  return { top, left, width, maxHeight };
}

const ROUTE_BY_CONSTRAINT: Record<TypeContrainte, string> = {
  [TypeContrainte.PAR_AN]: ROUTES.T5ParAn,
  [TypeContrainte.PAR_AN_PAR_ACTE]: ROUTES.T5ParAnParActe,
  [TypeContrainte.PAR_SEANCE]: ROUTES.T5Parseance,
};

export default function DropDownCell({
  options,
  refSocial,
  className = "",
  isLocked = false,
}: {
  options: DropdownOption[];
  refSocial: string;
  className?: string;
  isLocked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groups = [
    {
      type: "categorie" as const,
      label: "Catégories",
      options: options.filter((option) => option.type === "categorie"),
    },
    {
      type: "acte" as const,
      label: "Actes",
      options: options.filter((option) => option.type === "acte"),
    },
  ];

  function cancelScheduledClose() {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function showMenu() {
    if (isLocked || !triggerRef.current) return;
    cancelScheduledClose();
    setPosition(
      calculatePopoverPosition(
        triggerRef.current.getBoundingClientRect(),
        panelRef.current?.getBoundingClientRect().height ??
          POPOVER_MAX_HEIGHT,
      ),
    );
    setOpen(true);
  }

  function closeMenu() {
    cancelScheduledClose();
    setOpen(false);
    setPosition(null);
  }

  function scheduleClose() {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(closeMenu, 180);
  }

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      setPosition(
        calculatePopoverPosition(
          trigger.getBoundingClientRect(),
          panelRef.current?.getBoundingClientRect().height ??
            POPOVER_MAX_HEIGHT,
        ),
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    document.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("scroll", updatePosition, true);
      cancelScheduledClose();
    };
  }, [open, options.length]);

  return (
    <td
      className={`relative px-3 py-2 text-center ${className} ${isLocked ? "cursor-not-allowed bg-slate-100 opacity-60" : ""}`}
      onMouseEnter={showMenu}
      onMouseLeave={scheduleClose}
    >
      {!isLocked && (
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
          aria-label={`Afficher les ${options.length} suivis disponibles`}
          aria-expanded={open}
          onFocus={showMenu}
          onClick={(event) => {
            event.stopPropagation();
            showMenu();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeMenu();
          }}
        >
          <CirclePlus size={15} className="text-slate-500" aria-hidden="true" />
          <span>Suivis</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] leading-none text-slate-700">
            {options.length}
          </span>
          <ChevronDown
            size={13}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      )}

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-20 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-2xl ring-1 ring-slate-900/10"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            role="region"
            aria-label="Suivis du plafond disponibles"
            onMouseEnter={cancelScheduledClose}
            onMouseLeave={scheduleClose}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") closeMenu();
            }}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Suivis à effectuer
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Choisissez un acte ou une catégorie.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                {options.length}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {groups.map((group) =>
                group.options.length > 0 ? (
                  <section key={group.type} className="mb-2 last:mb-0">
                    <h3 className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {group.label}
                      <span className="font-medium tabular-nums">
                        {group.options.length}
                      </span>
                    </h3>
                    <ul className="space-y-1">
                      {group.options.map((option) => {
                        const route =
                          ROUTE_BY_CONSTRAINT[option.typeContrainte];
                        const path = fillPath(route, {
                          id: option.id,
                          label: option.label,
                          refSocial,
                        });

                        return (
                          <li key={`${option.type}-${option.id}`}>
                            <Link
                              className="group flex min-w-0 items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm text-slate-700 transition hover:border-red-100 hover:bg-red-50/60 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
                              to={{
                                pathname: path,
                                search: `?type=${option.type}`,
                              }}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Ouvrir le suivi de ${option.label} dans un nouvel onglet`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold">
                                  {option.label}
                                </span>
                                {option.type === "acte" &&
                                  option.categorieActe && (
                                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                                      {option.categorieActe}
                                    </span>
                                  )}
                              </span>
                              <ArrowUpRight
                                size={15}
                                className="shrink-0 text-slate-400 transition group-hover:text-red-600"
                                aria-hidden="true"
                              />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null,
              )}
            </div>
            <p className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
              Chaque élément s’ouvre dans un nouvel onglet.
            </p>
          </div>,
          document.body,
        )}
    </td>
  );
}
