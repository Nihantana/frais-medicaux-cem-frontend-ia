import { useCallback, useEffect, useState } from 'react';
import { Download, Printer, RefreshCw, Search } from 'lucide-react';
import { ErrorBlock, LoadingState, PageHeader } from '../components/ui';
import { getPaieEtat, getPaieEtatIndividuel, type PaieEtat, type PaieEtatIndividuel } from '../features/invoice/services/paieAPI';

const money = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (value: string | number | null | undefined) => value === null || value === undefined || value === '' ? '-' : money.format(Number(value));
const monthNow = () => new Date().toISOString().slice(0, 7);
const monthTitle = (value: string) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T00:00:00`)).toUpperCase();
const lineValue = (line: Record<string, string | number | null>, key: string) => line[key] ?? '';
const GLOBAL_HEADERS = ['Matricule agent', 'Nom et prénom de l’agent', 'Direction', 'Agence / service', 'Montant de l’acte', '100% CEM', 'Dépassement', '80% CEM', '20% Agent', 'Total à la charge de l’agent'];
const INDIVIDUAL_HEADERS = ['Date de l’acte', 'Nom et prénom du bénéficiaire', 'Nom de l’établissement', 'Code de l’acte', 'Montant de l’acte', '100% CEM', 'Dépassement', 'Observation sur le dépassement', '80% CEM', '20% Agent'];

export default function PaiePage() {
  const [mois, setMois] = useState(monthNow());
  const [etat, setEtat] = useState<PaieEtat | null>(null);
  const [im, setIm] = useState('');
  const [individual, setIndividual] = useState<PaieEtatIndividuel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIndividual(null);
    try {
      setEtat(await getPaieEtat(mois));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Impossible de charger l’état de paie.');
    } finally {
      setLoading(false);
    }
  }, [mois]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function searchAgent() { const matricule = Number(im); if (!Number.isInteger(matricule) || matricule <= 0) { setError('Saisissez un matricule valide.'); return; } setError(null); try { setIndividual(await getPaieEtatIndividuel(mois, matricule)); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'État individuel introuvable.'); } }
  function exportGlobalExcel() {
    if (!etat) return;
    downloadPaieWorkbook({
      filename: `etat-paie-${mois}.xlsx`,
      title: `ÉTAT DES RETENUES DES FRAIS MÉDICAUX – PAIE DU MOIS DE ${monthTitle(mois)}`,
      headers: GLOBAL_HEADERS,
      rows: etat.agents.map((agent) => [agent.im, agent.nomPrenom, agent.direction ?? '', agent.serviceAgence ?? '', agent.montantActe, agent.cem100, agent.depassement, agent.cem80, agent.agent20, agent.totalAgent]),
      total: ['TOTAL GENERAL', '', '', '', etat.total.montantActe, etat.total.cem100, etat.total.depassement, etat.total.cem80, etat.total.agent20, etat.total.totalAgent],
    });
  }
  function exportIndividualExcel() {
    if (!individual) return;
    const rows: Array<Array<string | number>> = [];
    for (const group of individual.groupes) {
      for (const line of group.lignes) {
        rows.push([lineValue(line, 'dateActe'), lineValue(line, 'nomPrenomBeneficiaire'), group.nomEtablissement, lineValue(line, 'codeActe'), lineValue(line, 'montantActe'), lineValue(line, 'cem100'), lineValue(line, 'depassement'), lineValue(line, 'obsDepassement'), lineValue(line, 'cem80'), lineValue(line, 'agent20')]);
      }
      rows.push(['', '', 'TOTAL ÉTABLISSEMENT :', '', group.totalEtablissement.montantActe, group.totalEtablissement.cem100, group.totalEtablissement.depassement, '', group.totalEtablissement.cem80, group.totalEtablissement.agent20]);
    }
    downloadPaieWorkbook({
      filename: `etat-paie-${mois}-matricule-${individual.im}.xlsx`,
      title: `ÉTAT DES RETENUES DES FRAIS MÉDICAUX – PAIE DU MOIS DE ${monthTitle(mois)}`,
      subtitle: `MATRICULE : ${individual.im}   |   NOM ET PRÉNOM AGENT : ${individual.nomPrenom}`,
      headers: INDIVIDUAL_HEADERS,
      rows,
      total: ['TOTAL GÉNÉRAL :', '', '', '', individual.totalGeneral.montantActe, individual.totalGeneral.cem100, individual.totalGeneral.depassement, '', individual.totalGeneral.cem80, individual.totalGeneral.agent20],
    });
  }
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Retenue sur salaire"
        description="Consultez et exportez les retenues liées aux frais médicaux."
      />
      {error && <ErrorBlock message={error} onRetry={() => void load()} />}

      <section className="panel grid grid-cols-1 items-end gap-3 p-4 print:hidden md:grid-cols-[12rem_11rem] xl:grid-cols-[12rem_11rem_minmax(12rem,1fr)_auto_auto]">
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-bold text-slate-600">
          Mois de paie
          <input
            type="month"
            className="field h-11"
            value={mois}
            onChange={(event) => setMois(event.target.value)}
          />
        </label>

        <button
          className="btn-primary h-11 w-full"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
          Actualiser
        </button>

        <div className="grid min-w-0 grid-cols-[minmax(8rem,1fr)_auto] items-end gap-2 md:col-span-2 xl:col-span-1">
          <label className="flex min-w-0 flex-col gap-1.5 text-xs font-bold text-slate-600">
            État par matricule
            <input
              className="field h-11"
              placeholder="Ex. 177"
              value={im}
              onChange={(event) => setIm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void searchAgent();
              }}
            />
          </label>
          <button className="btn-secondary h-11" onClick={() => void searchAgent()}>
            <Search size={16} />
            Consulter
          </button>
        </div>

        <button
          className="btn-secondary h-11"
          onClick={individual ? exportIndividualExcel : exportGlobalExcel}
          disabled={individual ? !individual : !etat}
        >
          <Download size={16} />
          Excel
        </button>
        <button
          className="btn-secondary h-11"
          onClick={() => window.print()}
          disabled={!etat && !individual}
        >
          <Printer size={16} />
          PDF
        </button>
      </section>

      {loading
        ? <LoadingState message="Chargement de l’état de paie…" />
        : individual
          ? <IndividualReport individual={individual} mois={mois} onBack={() => setIndividual(null)} />
          : <GlobalReport etat={etat} mois={mois} />}
    </div>
  );
}

function GlobalReport({ etat, mois }: { etat: PaieEtat | null; mois: string }) { const values = (agent: PaieEtat['agents'][number]) => [agent.im, agent.nomPrenom, agent.direction ?? '-', agent.serviceAgence ?? '-', agent.montantActe, agent.cem100, agent.depassement, agent.cem80, agent.agent20, agent.totalAgent]; return <section className="paie-report panel min-w-0 overflow-hidden"><ReportTitle title={`ÉTAT DES RETENUES DES FRAIS MÉDICAUX – PAIE DU MOIS DE ${monthTitle(mois)}`} /><ReportTable headers={GLOBAL_HEADERS} rows={etat?.agents.map((agent) => values(agent)) ?? []} total={['TOTAL GENERAL', '', '', '', ...(etat ? [etat.total.montantActe, etat.total.cem100, etat.total.depassement, etat.total.cem80, etat.total.agent20, etat.total.totalAgent] : [])]} /></section>; }

function IndividualReport({ individual, mois, onBack }: { individual: PaieEtatIndividuel; mois: string; onBack: () => void }) {
  const rows: Array<Array<string | number>> = [];
  for (const group of individual.groupes) {
    for (const line of group.lignes) {
      rows.push([lineValue(line, 'dateActe'), lineValue(line, 'nomPrenomBeneficiaire'), group.nomEtablissement, lineValue(line, 'codeActe'), lineValue(line, 'montantActe'), lineValue(line, 'cem100'), lineValue(line, 'depassement'), lineValue(line, 'obsDepassement'), lineValue(line, 'cem80'), lineValue(line, 'agent20')]);
    }
    rows.push(['', '', 'TOTAL ÉTABLISSEMENT :', '', group.totalEtablissement.montantActe, group.totalEtablissement.cem100, group.totalEtablissement.depassement, '', group.totalEtablissement.cem80, group.totalEtablissement.agent20]);
  }
  return <section className="paie-report panel min-w-0 overflow-hidden"><div className="print:hidden"><button className="btn-secondary m-4" onClick={onBack}>Retour à l’état global</button></div><ReportTitle title={`ÉTAT DES RETENUES DES FRAIS MÉDICAUX – PAIE DU MOIS DE ${monthTitle(mois)}`} subtitle={`MATRICULE : ${individual.im}   |   NOM et PRENOM AGENT : ${individual.nomPrenom}`} /><ReportTable headers={INDIVIDUAL_HEADERS} rows={rows} total={['TOTAL GÉNÉRAL :', '', '', '', individual.totalGeneral.montantActe, individual.totalGeneral.cem100, individual.totalGeneral.depassement, '', individual.totalGeneral.cem80, individual.totalGeneral.agent20]} /></section>;
}

function ReportTable({ headers, rows, total }: { headers: string[]; rows: Array<Array<string | number>>; total?: Array<string | number> }) { return <div className="paie-report-scroll w-full min-w-0 overflow-x-auto"><table className="min-w-[1000px] w-full border-collapse text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{headers.map((header) => <th key={header} className="max-w-[190px] whitespace-normal break-words border-b border-slate-200 px-3 py-3 text-left leading-tight">{header}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => { const isEtablissementTotal = String(row[2] ?? '').includes('TOTAL ÉTABLISSEMENT'); return <tr key={rowIndex} className={isEtablissementTotal ? 'border-b border-slate-200 bg-slate-50 font-bold' : 'border-b border-slate-100'}>{row.map((value, index) => <td key={index} className="max-w-[240px] whitespace-normal break-words px-3 py-3 text-left">{index > 3 && index !== 7 ? formatMoney(value) : value || '-'}</td>)}</tr>; })}</tbody>{total && <tfoot><tr>{total.map((value, index) => <td key={index} className="border-t-2 border-slate-200 px-3 py-3 text-left font-bold">{index > 3 ? formatMoney(value) : value}</td>)}</tr></tfoot>}</table>{rows.length === 0 && <p className="p-8 text-center text-slate-500">Aucune retenue clôturée pour ce mois.</p>}</div>; }

function ReportTitle({ title, subtitle }: { title: string; subtitle?: string }) { return <div className="border-b border-slate-200 p-4"><h2 className="break-words text-lg font-extrabold leading-tight text-slate-900">{title}</h2>{subtitle && <p className="mt-2 whitespace-pre-line break-words text-sm font-semibold text-slate-600">{subtitle}</p>}</div>; }
type PaieWorkbook = {
  filename: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  total?: Array<string | number>;
};

const xml = (value: string | number) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const columnName = (index: number) => { let name = ''; let value = index + 1; while (value) { const remainder = (value - 1) % 26; name = String.fromCharCode(65 + remainder) + name; value = Math.floor((value - 1) / 26); } return name; };
const crc32 = (content: Uint8Array) => { let crc = 0xffffffff; for (const byte of content) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; };
const uint16 = (value: number) => [value & 0xff, (value >>> 8) & 0xff];
const uint32 = (value: number) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];

function zipXlsx(files: Record<string, string>) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const entries: Array<{ name: Uint8Array; crc: number; size: number; offset: number }> = [];
  let offset = 0;
  for (const [path, content] of Object.entries(files)) {
    const name = encoder.encode(path); const data = encoder.encode(content); const crc = crc32(data);
    const header = new Uint8Array([...uint32(0x04034b50), ...uint16(20), ...uint16(0), ...uint16(0), ...uint16(0), ...uint16(0), ...uint32(crc), ...uint32(data.length), ...uint32(data.length), ...uint16(name.length), ...uint16(0)]);
    chunks.push(header, name, data); entries.push({ name, crc, size: data.length, offset }); offset += header.length + name.length + data.length;
  }
  const centralOffset = offset;
  for (const entry of entries) { const header = new Uint8Array([...uint32(0x02014b50), ...uint16(20), ...uint16(20), ...uint16(0), ...uint16(0), ...uint16(0), ...uint16(0), ...uint32(entry.crc), ...uint32(entry.size), ...uint32(entry.size), ...uint16(entry.name.length), ...uint16(0), ...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0), ...uint32(entry.offset)]); chunks.push(header, entry.name); offset += header.length + entry.name.length; }
  chunks.push(new Uint8Array([...uint32(0x06054b50), ...uint16(0), ...uint16(0), ...uint16(entries.length), ...uint16(entries.length), ...uint32(offset - centralOffset), ...uint32(centralOffset), ...uint16(0)]));
  const archive = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let position = 0; for (const chunk of chunks) { archive.set(chunk, position); position += chunk.length; }
  return new Blob([archive.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function downloadPaieWorkbook(workbook: PaieWorkbook) {
  const numericColumns = new Set([4, 5, 6, 7, 8, 9]);
  const firstTableRow = workbook.subtitle ? 4 : 3;
  const allRows = [...workbook.rows, ...(workbook.total ? [workbook.total] : [])];
  const cell = (value: string | number, index: number, row: number, style: number) => {
    const ref = `${columnName(index)}${row}`;
    if (numericColumns.has(index) && value !== '' && Number.isFinite(Number(value))) return `<c r="${ref}" s="${style === 4 ? 6 : 5}"><v>${Number(value)}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  };
  const dataRows = allRows.map((row, rowIndex) => { const isGeneralTotal = Boolean(workbook.total) && rowIndex === allRows.length - 1; const isEtablissementTotal = String(row[2] ?? '').includes('TOTAL ÉTABLISSEMENT'); const style = isGeneralTotal ? 4 : isEtablissementTotal ? 4 : 3; const isTotalRow = isGeneralTotal || isEtablissementTotal; return `<row r="${firstTableRow + 1 + rowIndex}"${isTotalRow ? ' ht="22" customHeight="1"' : ''}>${row.map((value, index) => cell(value, index, firstTableRow + 1 + rowIndex, style)).join('')}</row>`; }).join('');
  const subtitleRow = workbook.subtitle ? `<row r="2" ht="22" customHeight="1"><c r="A2" s="1" t="inlineStr"><is><t>${xml(workbook.subtitle)}</t></is></c></row>` : '';
  const lastRow = firstTableRow + allRows.length;
  // In the SpreadsheetML schema, autoFilter must precede mergeCells. Excel repairs a
  // worksheet when that order is reversed, even though its XML is well-formed.
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><selection activeCell="A1"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/><col min="3" max="4" width="18" customWidth="1"/><col min="5" max="10" width="15" customWidth="1"/></cols><sheetData><row r="1" ht="30" customHeight="1"><c r="A1" s="0" t="inlineStr"><is><t>${xml(workbook.title)}</t></is></c></row>${subtitleRow}<row r="${firstTableRow}" ht="34" customHeight="1">${workbook.headers.map((header, index) => `<c r="${columnName(index)}${firstTableRow}" s="2" t="inlineStr"><is><t>${xml(header)}</t></is></c>`).join('')}</row>${dataRows}</sheetData><autoFilter ref="A${firstTableRow}:J${lastRow}"/><mergeCells count="${workbook.subtitle ? 2 : 1}"><mergeCell ref="A1:J1"/>${workbook.subtitle ? '<mergeCell ref="A2:J2"/>' : ''}</mergeCells><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="3"><font><sz val="14"/><b/><color rgb="FF1F4E78"/><name val="Calibri"/></font><font><sz val="11"/><b/><color rgb="FF1F1F1F"/><name val="Calibri"/></font><font><sz val="10"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/></border><border><left style="thin"><color rgb="FF9EADBA"/></left><right style="thin"><color rgb="FF9EADBA"/></right><top style="thin"><color rgb="FF9EADBA"/></top><bottom style="thin"><color rgb="FF9EADBA"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="2" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="1" fillId="3" borderId="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf></cellXfs></styleSheet>`;
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="État de paie" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': styles,
    'xl/worksheets/sheet1.xml': sheet,
  };
  const url = URL.createObjectURL(zipXlsx(files)); const link = document.createElement('a'); link.href = url; link.download = workbook.filename; link.click(); URL.revokeObjectURL(url);
}
