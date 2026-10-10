import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextDirection,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
} from "docx";
import { CREST_PNG_BASE64 } from "./crest";
import { fitSignature, formatSignedDate, imageTypeOf, type Signoff } from "../signoff";
import type { ProgDoc } from "./programme-layout";

/* Part-time / postgraduate lecture timetable as Word: A4 landscape when there are many periods (part-time),
   portrait otherwise (M.Sc.). Grid, key to venues, calendar, notes, course allocation and signature. */

const FONT = "Calibri";
const C = { navy: "0B2545", teal: "0E7C7B", ink: "1E293B", mute: "64748B", line: "CBD5E1", soft: "F5F7FA", venue: "E8EEF4", comp: "D7EFEC", compInk: "0A4F4C", act: "ECE6F7", actInk: "44337A" };
type Edge = { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
type Edges = { top: Edge; bottom: Edge; left: Edge; right: Edge };
const thin: Edge = { style: BorderStyle.SINGLE, size: 4, color: C.line };
const none: Edge = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders: Edges = { top: none, bottom: none, left: none, right: none };
const allThin: Edges = { top: thin, bottom: thin, left: thin, right: thin };

const R = (text: string, o: { size?: number; bold?: boolean; italics?: boolean; color?: string; cs?: number } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 17, bold: o.bold, italics: o.italics, color: o.color ?? C.ink, characterSpacing: o.cs });
const P = (children: TextRun[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; before?: number } = {}) =>
  new Paragraph({ alignment: o.align ?? AlignmentType.CENTER, spacing: { before: o.before ?? 0, after: o.after ?? 0, line: 230 }, children });
const H = (t: string) => new Paragraph({ keepNext: true, spacing: { before: 100, after: 40 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.teal, space: 2 } }, children: [R(t, { size: 16, bold: true, color: C.navy, cs: 30 })] });
const cell = (w: number, children: Paragraph[], o: { fill?: string; span?: number; merge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType]; borders?: Edges; vertical?: boolean } = {}) =>
  new TableCell({
    width: { size: w, type: WidthType.DXA },
    columnSpan: o.span,
    verticalMerge: o.merge,
    verticalAlign: VerticalAlign.CENTER,
    textDirection: o.vertical ? TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT : undefined,
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 30, bottom: 30, left: 50, right: 50 },
    borders: o.borders ?? allThin,
    children,
  });

export async function buildProgrammeDocx(doc: ProgDoc, signoff: Signoff): Promise<Buffer> {
  const TW = doc.landscape ? 15838 : 10506;
  const logo = Buffer.from(CREST_PNG_BASE64, "base64");
  const title = new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [1000, TW - 2000, 1000],
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: [
          cell(1000, [new Paragraph({ children: [new ImageRun({ type: "png", data: logo, transformation: { width: 48, height: 46 }, altText: { title: "UNIBEN crest", description: "University of Benin crest", name: "crest" } })] })], { borders: noBorders }),
          cell(
            TW - 2000,
            [
              P([R(doc.heading[0], { size: 26, bold: true, color: C.navy, cs: 20 })]),
              P([R(doc.heading[1], { size: 15, bold: true, color: C.mute, cs: 30 })]),
              P([R(doc.heading[2], { size: 15, bold: true, color: C.mute, cs: 30 })]),
              P([R(doc.title, { size: 18, bold: true, color: C.teal })], { before: 40 }),
            ],
            { borders: noBorders },
          ),
          cell(1000, [new Paragraph({ children: [] })], { borders: noBorders }),
        ],
      }),
    ],
  });

  // Column widths: day, (group), periods (breaks narrow).
  const dayW = doc.landscape ? 1250 : 1450;
  const groupW = doc.showGroups ? 1000 : 0;
  const brkW = 380;
  const nBreak = doc.periods.filter((p) => p.isBreak).length;
  const pw = Math.floor((TW - dayW - groupW - nBreak * brkW) / Math.max(1, doc.periods.length - nBreak));
  const widths = [dayW, ...(doc.showGroups ? [groupW] : []), ...doc.periods.map((p) => (p.isBreak ? brkW : pw))];
  const colStart = doc.showGroups ? 2 : 1;
  const widthOf = (start: number, span: number) => widths.slice(colStart + start, colStart + start + span).reduce((a, b) => a + b, 0);

  const head = new TableRow({
    tableHeader: true,
    children: [
      cell(dayW, [P([R("DAY", { size: 14, bold: true, color: "FFFFFF" })])], { fill: C.navy }),
      ...(doc.showGroups ? [cell(groupW, [P([R("YEAR / TIME", { size: 14, bold: true, color: "FFFFFF" })])], { fill: C.navy })] : []),
      ...doc.periods.map((p) => cell(p.isBreak ? brkW : pw, [P([R(p.label, { size: p.isBreak ? 11 : 14, bold: true, color: "FFFFFF" })])], { fill: p.isBreak ? C.teal : C.navy, vertical: p.isBreak })),
    ],
  });
  const body = doc.rows.map((r) => {
    const merge = r.rowsInDay > 1 ? (r.firstOfDay ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE) : undefined;
    return new TableRow({
      cantSplit: true,
      children: [
        cell(dayW, [P(r.firstOfDay ? [R(r.day, { size: 15, bold: true, color: C.navy })] : [])], { fill: C.venue, merge }),
        ...(doc.showGroups ? [cell(groupW, [P([R(r.group, { size: 15, bold: true, color: C.navy })])], { fill: C.soft })] : []),
        ...r.cells.map((c) =>
          c.type === "break"
            ? cell(brkW, [P(r.firstOfDay ? [R("BREAK", { size: 12, bold: true, color: "FFFFFF", cs: 40 })] : [])], { fill: C.teal, merge, vertical: true })
            : c.type === "slot"
              ? cell(widthOf(c.start, c.span), [P([R(c.text, { size: 16, bold: !c.activity, italics: c.activity, color: c.activity ? C.actInk : C.compInk })])], { fill: c.activity ? C.act : C.comp, span: c.span > 1 ? c.span : undefined })
              : cell(pw, [new Paragraph({ children: [] })]),
        ),
      ],
    });
  });
  const grid = new Table({ width: { size: TW, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: widths, rows: [head, ...body] });

  const half = Math.floor((TW - 400) / 2);
  const twoCols = (left: (Paragraph | Table)[], right: (Paragraph | Table)[], bottomRight = false) =>
    new Table({
      width: { size: TW, type: WidthType.DXA },
      columnWidths: [half, 400, half],
      borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({ width: { size: half, type: WidthType.DXA }, borders: noBorders, children: left.length ? left : [new Paragraph({ children: [] })] }),
            new TableCell({ width: { size: 400, type: WidthType.DXA }, borders: noBorders, children: [new Paragraph({ children: [] })] }),
            new TableCell({ width: { size: half, type: WidthType.DXA }, borders: noBorders, verticalAlign: bottomRight ? VerticalAlign.BOTTOM : VerticalAlign.TOP, children: right.length ? right : [new Paragraph({ children: [] })] }),
          ],
        }),
      ],
    });

  const keyPart: Paragraph[] = [];
  if (doc.venueKey.length) {
    keyPart.push(H("KEY TO VENUE ALLOCATION"));
    for (const v of doc.venueKey) keyPart.push(new Paragraph({ spacing: { after: 10 }, children: [R(v.code, { size: 16, bold: true, color: C.teal }), R(` = ${v.name}`, { size: 16 })] }));
  }
  for (const n of doc.notes) keyPart.push(new Paragraph({ spacing: { before: 40, after: 20 }, children: [R("❖ ", { size: 15, color: C.teal }), R(n, { size: 16, bold: true })] }));
  const calPart: (Paragraph | Table)[] = [];
  if (doc.calendar.length) {
    calPart.push(H("CALENDAR"));
    const cw = [Math.round(half * 0.16), Math.round(half * 0.34), half - Math.round(half * 0.16) - Math.round(half * 0.34)];
    calPart.push(
      new Table({
        width: { size: half, type: WidthType.DXA },
        columnWidths: cw,
        rows: [
          new TableRow({ children: ["WEEKS", "DATES", "ACTIVITIES"].map((h, i) => cell(cw[i], [P([R(h, { size: 13, bold: true, color: "FFFFFF" })], { align: AlignmentType.LEFT })], { fill: C.navy })) }),
          ...doc.calendar.map((c) => new TableRow({ children: [c.weeks, c.dates, c.activity].map((x, i) => cell(cw[i], [P([R(x, { size: 14 })], { align: AlignmentType.LEFT })])) })),
        ],
      }),
    );
  }
  const allocPart: Paragraph[] = [];
  if (doc.allocation.length) {
    allocPart.push(H("COURSE ALLOCATION"));
    for (const a of doc.allocation) {
      allocPart.push(P([R(a.semester, { size: 16, bold: true, color: C.teal })], { align: AlignmentType.LEFT, before: 40 }));
      a.lines.forEach((l, i) => allocPart.push(new Paragraph({ spacing: { after: 10 }, indent: { left: 360, hanging: 360 }, tabStops: [{ type: TabStopType.LEFT, position: 360 }], children: [R(`${i + 1}.\t`, { size: 16 }), R(l, { size: 16 })] })));
    }
    if (doc.hasCategories) allocPart.push(P([R("*Core courses; +Mandatory courses; E Elective courses", { size: 14, italics: true, color: C.mute })], { align: AlignmentType.LEFT, before: 30 }));
  }
  const sigPart: Paragraph[] = [P([R(`Signed (${formatSignedDate(signoff.signedOn) ?? "____/____/______"})`, { size: 15, italics: true, color: C.mute })], { align: AlignmentType.LEFT, before: 140 })];
  if (signoff.image && signoff.width && signoff.height)
    sigPart.push(new Paragraph({ children: [new ImageRun({ type: imageTypeOf(signoff.image), data: Buffer.from(signoff.image.slice(signoff.image.indexOf(",") + 1), "base64"), transformation: fitSignature(signoff.width, signoff.height, 160, 50), altText: { title: "Signature", description: "Signature", name: "signature" } })] }));
  else sigPart.push(new Paragraph({ spacing: { before: 240 }, children: [] }));
  sigPart.push(
    new Paragraph({ spacing: { after: 20 }, indent: { right: Math.max(0, half - 3600) }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: C.navy, space: 3 } }, children: [R(doc.signatory.name || " ", { size: 18, bold: true, color: C.navy })] }),
    P([R(doc.signatory.role, { size: 15 })], { align: AlignmentType.LEFT }),
  );
  const below: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { before: 0, after: 0, line: 120 }, children: [] }),
    ...(keyPart.length || calPart.length ? [twoCols(keyPart, calPart), new Paragraph({ spacing: { before: 0, after: 0, line: 120 }, children: [] })] : []),
    twoCols(allocPart, sigPart, true),
  ];

  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TW }],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 4 } },
        children: [
          R("Faculty of Computing  ·  University of Benin", { size: 14, color: C.mute, bold: true }),
          R("\tLecture Time-Table   |   Page ", { size: 14, color: C.mute }),
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
        properties: {
          page: doc.landscape
            ? { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 450, bottom: 450, left: 500, right: 500, header: 200, footer: 220 } }
            : { size: { width: 11906, height: 16838 }, margin: { top: 600, bottom: 600, left: 700, right: 700, header: 250, footer: 250 } },
        },
        footers: { default: footer },
        children: [title, new Paragraph({ spacing: { before: 30, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.teal, space: 1 } }, children: [] }), grid, ...below],
      },
    ],
  });
  return Packer.toBuffer(d);
}
