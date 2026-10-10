import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { CREST_PNG_BASE64 } from "./crest";
import { fitSignature, formatSignedDate, imageTypeOf, type Signoff } from "../signoff";
import type { InvDoc } from "./invigilation-layout";

/* Invigilation schedule as a Word document: A4 landscape like the Faculty's schedule —
   "PAPER (year, venue) CHIEF: ASSISTANTS" in each session — then the duties of each person. */

const FONT = "Calibri";
const C = { navy: "0B2545", teal: "0E7C7B", ink: "1E293B", mute: "64748B", line: "CBD5E1", soft: "F5F7FA", gen: "FCEFD2", genInk: "6E4300" };
const TW = 15838; // A4 landscape 16838 − 2 × 500
type Edge = { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
type Edges = { top: Edge; bottom: Edge; left: Edge; right: Edge };
const thin: Edge = { style: BorderStyle.SINGLE, size: 4, color: C.line };
const none: Edge = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders: Edges = { top: none, bottom: none, left: none, right: none };
const allThin: Edges = { top: thin, bottom: thin, left: thin, right: thin };

const R = (text: string, o: { size?: number; bold?: boolean; italics?: boolean; color?: string; cs?: number; font?: string } = {}) =>
  new TextRun({ text, font: o.font ?? FONT, size: o.size ?? 17, bold: o.bold, italics: o.italics, color: o.color ?? C.ink, characterSpacing: o.cs });
const P = (children: TextRun[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; before?: number; shade?: string; keepNext?: boolean } = {}) =>
  new Paragraph({
    alignment: o.align ?? AlignmentType.CENTER,
    keepNext: o.keepNext,
    spacing: { before: o.before ?? 0, after: o.after ?? 0, line: 230 },
    shading: o.shade ? { type: ShadingType.CLEAR, color: "auto", fill: o.shade } : undefined,
    children,
  });
const H = (t: string) => new Paragraph({ keepNext: true, spacing: { before: 60, after: 40 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.teal, space: 2 } }, children: [R(t, { size: 16, bold: true, color: C.navy, cs: 30 })] });
const cell = (w: number, children: Paragraph[], o: { fill?: string; span?: number; center?: boolean; borders?: Edges } = {}) =>
  new TableCell({
    width: { size: w, type: WidthType.DXA },
    columnSpan: o.span,
    verticalAlign: o.center ? VerticalAlign.CENTER : VerticalAlign.TOP,
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 30, bottom: 40, left: 70, right: 70 },
    borders: o.borders ?? allThin,
    children,
  });

function title(doc: InvDoc) {
  const logo = Buffer.from(CREST_PNG_BASE64, "base64");
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [1000, TW - 2000, 1000],
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: [
          cell(1000, [new Paragraph({ children: [new ImageRun({ type: "png", data: logo, transformation: { width: 48, height: 46 }, altText: { title: "UNIBEN crest", description: "University of Benin crest", name: "crest" } })] })], { borders: noBorders, center: true }),
          cell(
            TW - 2000,
            [P([R(doc.heading[0], { size: 28, bold: true, color: C.navy, cs: 20 })]), P([R(doc.heading[1], { size: 15, bold: true, color: C.mute, cs: 30 })]), P([R(doc.title, { size: 18, bold: true, color: C.teal })], { before: 30 })],
            { borders: noBorders, center: true },
          ),
          cell(1000, [new Paragraph({ children: [] })], { borders: noBorders }),
        ],
      }),
    ],
  });
}

function grid(doc: InvDoc) {
  const dateW = 1300;
  const sw = Math.floor((TW - dateW) / doc.sessions.length);
  const widths = [dateW, ...doc.sessions.map(() => sw)];
  const head = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      cell(dateW, [P([R("DATE", { size: 16, bold: true, color: "FFFFFF", cs: 20 })])], { fill: C.navy, center: true }),
      ...doc.sessions.map((s) => cell(sw, [P([R(s.name.toUpperCase(), { size: 16, bold: true, color: "FFFFFF" })]), P([R(s.time, { size: 14, color: "D5DEEA" })])], { fill: C.navy, center: true })),
    ],
  });
  const body = doc.rows.map((r) =>
    r.type === "week"
      ? new TableRow({ cantSplit: true, children: [cell(TW, [P([R(r.label, { size: 15, bold: true, color: "FFFFFF", cs: 60 })])], { fill: C.teal, span: widths.length })] })
      : new TableRow({
          cantSplit: true,
          children: [
            cell(dateW, [P([R(r.day, { size: 17, bold: true, color: C.navy })]), P([R(r.date, { size: 15, color: C.mute })])], { fill: C.soft, center: true }),
            ...r.cells.map((c) =>
              cell(
                sw,
                c.lines.length
                  ? c.lines.map((l) =>
                      l.block
                        ? P([R(l.paper, { size: 16, bold: true, color: C.genInk, cs: 60 })], { shade: C.gen })
                        : new Paragraph({
                            spacing: { after: 50, line: 230 },
                            children: [R(`${l.paper} `, { size: 16 }), R(l.chief || "______", { size: 16, bold: true }), R(l.assistants ? `: ${l.assistants}` : "", { size: 16 })],
                          }),
                    )
                  : [new Paragraph({ children: [] })],
              ),
            ),
          ],
        }),
  );
  return new Table({ width: { size: TW, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: widths, rows: [head, ...body] });
}

function foot(doc: InvDoc, signoff: Signoff) {
  const sig: Paragraph[] = [P([R(`Signed (${formatSignedDate(signoff.signedOn) ?? "____/____/______"})`, { size: 16, italics: true, color: C.mute })], { align: AlignmentType.LEFT })];
  if (signoff.image && signoff.width && signoff.height)
    sig.push(
      new Paragraph({
        children: [new ImageRun({ type: imageTypeOf(signoff.image), data: Buffer.from(signoff.image.slice(signoff.image.indexOf(",") + 1), "base64"), transformation: fitSignature(signoff.width, signoff.height, 160, 50), altText: { title: "Signature", description: "Signature", name: "signature" } })],
      }),
    );
  else sig.push(new Paragraph({ spacing: { before: 240 }, children: [] }));
  sig.push(
    new Paragraph({ spacing: { after: 20 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: C.navy, space: 3 } }, children: [R(doc.signatory.name || " ", { size: 18, bold: true, color: C.navy })] }),
    P([R(doc.signatory.role, { size: 15 })], { align: AlignmentType.LEFT }),
  );
  if (doc.signatory.forWhom) sig.push(P([R(doc.signatory.forWhom, { size: 15, italics: true, color: C.mute })], { align: AlignmentType.LEFT }));
  const list = (items: string[]) => (items.length ? items.map((x) => P([R(x, { size: 15 })], { align: AlignmentType.LEFT, after: 10 })) : [new Paragraph({ children: [] })]);
  const cols = [
    sig,
    doc.levels.length ? [H("LEVEL"), ...list(doc.levels)] : [new Paragraph({ children: [] })],
    doc.venues.length ? [H("VENUE FOR EXAMINATION"), ...list(doc.venues.map((v) => `${v.code} – ${v.name}`))] : [new Paragraph({ children: [] })],
    [H("KEY"), P([R("NAME", { size: 15, bold: true }), R(" in bold — chief invigilator; the names after it are the assistant invigilators.", { size: 15 })], { align: AlignmentType.LEFT })],
  ];
  const w = Math.floor(TW / 4);
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: cols.map(() => w),
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ cantSplit: true, children: cols.map((c) => cell(w, c, { borders: noBorders })) })],
  });
}

function duties(doc: InvDoc) {
  if (!doc.duties.length) return [];
  const w = [2600, 900, 1100, TW - 4600];
  const hc = (t: string, i: number) => cell(w[i], [P([R(t, { size: 15, bold: true, color: "FFFFFF" })], { align: AlignmentType.LEFT })], { fill: C.navy });
  return [
    new Paragraph({ children: [new PageBreak()] }),
    H("DUTIES BY INVIGILATOR"),
    new Table({
      width: { size: TW, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: w,
      rows: [
        new TableRow({ tableHeader: true, children: ["Name", "Chief", "Assistant", "Duties"].map(hc) }),
        ...doc.duties.map(
          (d) =>
            new TableRow({
              cantSplit: true,
              children: [
                cell(w[0], [P([R(d.short, { size: 16, bold: true })], { align: AlignmentType.LEFT }), P([R(d.name, { size: 14, color: C.mute })], { align: AlignmentType.LEFT })]),
                cell(w[1], [P([R(String(d.chief), { size: 16 })])]),
                cell(w[2], [P([R(String(d.assistant), { size: 16 })])]),
                cell(w[3], [P([R(d.duties.join("  ·  "), { size: 15 })], { align: AlignmentType.LEFT })]),
              ],
            }),
        ),
      ],
    }),
  ];
}

export async function buildInvigilationDocx(doc: InvDoc, signoff: Signoff): Promise<Buffer> {
  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TW }],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 4 } },
        children: [
          R("Faculty of Computing  ·  University of Benin", { size: 14, color: C.mute, bold: true }),
          R("\tInvigilation Schedule   |   Page ", { size: 14, color: C.mute }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: C.navy, bold: true }),
          R(" of ", { size: 14, color: C.mute }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14, color: C.navy, bold: true }),
        ],
      }),
    ],
  });
  const d = new Document({
    creator: "Faculty of Computing, University of Benin",
    title: doc.title,
    styles: { default: { document: { run: { font: FONT, size: 17 } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 450, bottom: 450, left: 500, right: 500, header: 200, footer: 220 } } },
        footers: { default: footer },
        children: [
          title(doc),
          new Paragraph({ spacing: { before: 30, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.teal, space: 1 } }, children: [] }),
          grid(doc),
          new Paragraph({ spacing: { before: 0, after: 60, line: 120 }, children: [] }),
          foot(doc, signoff),
          ...duties(doc),
        ],
      },
    ],
  });
  return Packer.toBuffer(d);
}
