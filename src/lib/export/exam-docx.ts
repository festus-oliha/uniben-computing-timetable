import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
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
import type { ExamDoc } from "./exam-layout";

/* Examination timetable as a Word document: A4 portrait, date rows × session columns,
   then notes, the key to the venues used, distribution and the signature. */

const FONT = "Calibri";
const C = { navy: "0B2545", navy2: "16365F", teal: "0E7C7B", ink: "1E293B", mute: "64748B", line: "CBD5E1", soft: "F5F7FA", gen: "FCEFD2", genInk: "6E4300" };
const TW = 10706; // A4 width 11906 − 2 × 600 margins
const thin = { style: BorderStyle.SINGLE, size: 4, color: C.line };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none };
const allThin = { top: thin, bottom: thin, left: thin, right: thin };

const R = (text: string, o: { size?: number; bold?: boolean; italics?: boolean; color?: string; cs?: number } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 18, bold: o.bold, italics: o.italics, color: o.color ?? C.ink, characterSpacing: o.cs });
const P = (children: TextRun[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; before?: number; keepNext?: boolean; shade?: string } = {}) =>
  new Paragraph({
    alignment: o.align ?? AlignmentType.CENTER,
    keepNext: o.keepNext,
    spacing: { before: o.before ?? 0, after: o.after ?? 0, line: 240 },
    shading: o.shade ? { type: ShadingType.CLEAR, color: "auto", fill: o.shade } : undefined,
    children,
  });
const H = (t: string) =>
  new Paragraph({ keepNext: true, spacing: { before: 140, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.teal, space: 2 } }, children: [R(t, { size: 19, bold: true, color: C.navy, cs: 30 })] });

function title(doc: ExamDoc) {
  const logo = Buffer.from(CREST_PNG_BASE64, "base64");
  const lines = [
    P([R(doc.faculty, { size: 32, bold: true, color: C.navy, cs: 20 })]),
    P([R(doc.university, { size: 15, bold: true, color: C.mute, cs: 40 })]),
    ...(doc.department ? [P([R(doc.department, { size: 18, bold: true, color: C.navy })], { before: 20 })] : []),
    P([R(doc.title, { size: 19, bold: true, color: C.teal })], { before: 30 }),
  ];
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [1100, TW - 2200, 1100],
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1100, type: WidthType.DXA },
            borders: noBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ children: [new ImageRun({ type: "png", data: logo, transformation: { width: 54, height: 52 }, altText: { title: "UNIBEN crest", description: "University of Benin crest", name: "crest" } })] })],
          }),
          new TableCell({ width: { size: TW - 2200, type: WidthType.DXA }, borders: noBorders, verticalAlign: VerticalAlign.CENTER, children: lines }),
          new TableCell({ width: { size: 1100, type: WidthType.DXA }, borders: noBorders, children: [new Paragraph({ children: [] })] }),
        ],
      }),
    ],
  });
}

function grid(doc: ExamDoc) {
  const dateW = 1400;
  const sw = Math.floor((TW - dateW) / doc.sessions.length);
  const widths = [dateW, ...doc.sessions.map(() => sw)];
  const cell = (w: number, children: Paragraph[], o: { fill?: string; span?: number; align?: typeof VerticalAlign.TOP | typeof VerticalAlign.CENTER } = {}) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA },
      columnSpan: o.span,
      verticalAlign: o.align ?? VerticalAlign.TOP,
      shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
      margins: { top: 30, bottom: 50, left: 60, right: 60 },
      borders: allThin,
      children,
    });

  const head = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      cell(dateW, [P([R("DATE", { size: 17, bold: true, color: "FFFFFF", cs: 20 })])], { fill: C.navy, align: VerticalAlign.CENTER }),
      ...doc.sessions.map((s) => cell(sw, [P([R(s.name.toUpperCase(), { size: 17, bold: true, color: "FFFFFF", cs: 10 })]), P([R(s.time, { size: 15, color: "D5DEEA" })])], { fill: C.navy, align: VerticalAlign.CENTER })),
    ],
  });

  const body = doc.rows.map((r) =>
    r.type === "week"
      ? new TableRow({ cantSplit: true, children: [cell(TW, [P([R(r.label, { size: 16, bold: true, color: "FFFFFF", cs: 40 })], { align: AlignmentType.LEFT })], { fill: C.teal, span: widths.length })] })
      : new TableRow({
          cantSplit: true,
          children: [
            cell(dateW, [P([R(r.day, { size: 19, bold: true, color: C.navy })]), P([R(r.date, { size: 16, color: C.mute })])], { fill: C.soft, align: VerticalAlign.CENTER }),
            ...r.cells.map((c) =>
              cell(sw, [
                P([R(`SESSION ${c.number}`, { size: 13, bold: true, color: C.mute, cs: 20 })], { after: 20 }),
                ...c.lines.map((l) => (l.block ? P([R(l.text, { size: 18, bold: true, color: C.genInk, cs: 60 })], { shade: C.gen }) : P([R(l.text, { size: 18, bold: true })], { after: 10 }))),
              ]),
            ),
          ],
        }),
  );
  return new Table({ width: { size: TW, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: widths, rows: [head, ...body] });
}

function notesAndKey(doc: ExamDoc) {
  const leftW = 6300;
  const gap = 300;
  const rightW = TW - leftW - gap;
  const left: Paragraph[] = [];
  if (doc.notes.length) {
    left.push(H("NOTE THE FOLLOWING"));
    doc.notes.forEach((n, i) =>
      left.push(new Paragraph({ spacing: { after: 40, line: 250 }, indent: { left: 360, hanging: 360 }, children: [R(`${i + 1}.\t`, { size: 17, bold: true, color: C.teal }), R(n, { size: 17 })], tabStops: [{ type: TabStopType.LEFT, position: 360 }] })),
    );
  }
  if (doc.closing) left.push(P([R(doc.closing, { size: 17, bold: true, italics: true })], { align: AlignmentType.LEFT, before: 60 }));
  const right: Paragraph[] = [];
  if (doc.venues.length) {
    right.push(H("KEY TO VENUE ALLOCATION"));
    for (const v of doc.venues)
      right.push(new Paragraph({ spacing: { after: 30, line: 240 }, indent: { left: 700, hanging: 700 }, tabStops: [{ type: TabStopType.LEFT, position: 700 }], children: [R(`${v.code}\t`, { size: 17, bold: true, color: C.teal }), R(v.name, { size: 17 })] }));
  }
  if (!left.length && !right.length) return [];
  return [
    new Table({
      width: { size: TW, type: WidthType.DXA },
      columnWidths: [leftW, gap, rightW],
      borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: leftW, type: WidthType.DXA }, borders: noBorders, children: left.length ? left : [new Paragraph({ children: [] })] }),
            new TableCell({ width: { size: gap, type: WidthType.DXA }, borders: noBorders, children: [new Paragraph({ children: [] })] }),
            new TableCell({ width: { size: rightW, type: WidthType.DXA }, borders: noBorders, children: right.length ? right : [new Paragraph({ children: [] })] }),
          ],
        }),
      ],
    }),
  ];
}

function ccAndSignature(doc: ExamDoc, signoff: Signoff) {
  const leftW = 6300;
  const gap = 300;
  const rightW = TW - leftW - gap;
  const cc = doc.cc.map((c, i) => new Paragraph({ keepNext: true, spacing: { after: 10, line: 230 }, indent: { left: 500, hanging: 500 }, tabStops: [{ type: TabStopType.LEFT, position: 500 }], children: [R(i === 0 ? "cc:\t" : "“\t", { size: 16, bold: i === 0, color: C.teal }), R(c, { size: 16 })] }));
  const sig: Paragraph[] = [P([R(`Signed (${formatSignedDate(signoff.signedOn) ?? "____/____/______"})`, { size: 17, italics: true, color: C.mute })], { align: AlignmentType.LEFT, before: 120, keepNext: true })];
  if (signoff.image && signoff.width && signoff.height) {
    sig.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 40 },
        children: [new ImageRun({ type: imageTypeOf(signoff.image), data: Buffer.from(signoff.image.slice(signoff.image.indexOf(",") + 1), "base64"), transformation: fitSignature(signoff.width, signoff.height, 170, 56), altText: { title: "Signature", description: `Signature of ${doc.signatory.name}`, name: "signature" } })],
      }),
    );
  } else sig.push(new Paragraph({ spacing: { before: 300 }, children: [] }));
  sig.push(
    new Paragraph({ keepNext: true, spacing: { before: 20, after: 30 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: C.navy, space: 4 } }, children: [R(doc.signatory.name || " ", { size: 19, bold: true, color: C.navy })] }),
    P([R(doc.signatory.role, { size: 16 })], { align: AlignmentType.LEFT }),
  );
  if (doc.signatory.forWhom) sig.push(P([R(doc.signatory.forWhom, { size: 16, italics: true, color: C.mute })], { align: AlignmentType.LEFT }));
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [leftW, gap, rightW],
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({ width: { size: leftW, type: WidthType.DXA }, borders: noBorders, children: [new Paragraph({ spacing: { before: 120 }, children: [] }), ...cc] }),
          new TableCell({ width: { size: gap, type: WidthType.DXA }, borders: noBorders, children: [new Paragraph({ children: [] })] }),
          new TableCell({ width: { size: rightW, type: WidthType.DXA }, borders: noBorders, verticalAlign: VerticalAlign.BOTTOM, children: sig }),
        ],
      }),
    ],
  });
}

export async function buildExamDocx(doc: ExamDoc, signoff: Signoff): Promise<Buffer> {
  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TW }],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 4 } },
        children: [
          R("Faculty of Computing  ·  University of Benin", { size: 14, color: C.mute, bold: true }),
          R("\tExamination Time-Table   |   Page ", { size: 14, color: C.mute }),
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
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 500, bottom: 500, left: 600, right: 600, header: 250, footer: 250 } } },
        footers: { default: footer },
        children: [
          title(doc),
          new Paragraph({ spacing: { before: 40, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.teal, space: 1 } }, children: [] }),
          grid(doc),
          // A paragraph between tables stops Word from joining them into one table.
          new Paragraph({ spacing: { before: 0, after: 0, line: 120 }, children: [] }),
          ...notesAndKey(doc),
          ccAndSignature(doc, signoff),
        ],
      },
    ],
  });
  return Packer.toBuffer(d);
}
