type Detail = {
  label: string;
  value: string;
};

type Props = {
  title: string;
  description: string;
  refSocial?: string;
  details: Detail[];
};

export default function T5PageHeader({
  title,
  description,
  refSocial,
  details,
}: Props) {
  return (
    <header className="shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">
            Suivi des plafonds de frais médicaux
          </p>
          <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
          {refSocial && (
            <p className="mt-3 text-xs font-medium text-slate-500">
              Référence sociale{" "}
              <span className="rounded-md bg-slate-100 px-2 py-1 font-mono font-bold text-slate-700">
                {refSocial}
              </span>
            </p>
          )}
        </div>
        <dl className="grid shrink-0 gap-2 sm:grid-cols-2 lg:max-w-[560px]">
          {details.map((detail) => (
            <div
              key={detail.label}
              className="min-w-[150px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
            >
              <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {detail.label}
              </dt>
              <dd className="mt-1 text-sm font-bold text-slate-800">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
