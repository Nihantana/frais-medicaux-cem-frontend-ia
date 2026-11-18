import { Search } from "lucide-react";

export default function T5SearchPrompt({ refSocial }: { refSocial?: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
          <Search size={22} />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-900">
          Recherchez un agent pour continuer
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Saisissez l’identifiant du bénéficiaire dans le panneau latéral pour
          consulter ses frais et leur suivi.
        </p>
        {refSocial && (
          <p className="mt-4 inline-flex rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs font-semibold text-slate-700">
            Référence sociale : {refSocial}
          </p>
        )}
      </div>
    </div>
  );
}
