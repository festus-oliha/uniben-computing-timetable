import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
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
  WidthType,
} from "docx";
import { DAYS } from "../timetable";
import type { Category } from "../timetable";
import type { TimetableData } from "../types";
import { CREST_PNG_BASE64 } from "./crest";
import { DOCUMENT_TEXT as T, signedDate } from "./document-text";
import { printLayout, type PrintCell } from "./layout";

/* Official timetable as a Word document: A4 landscape, timetable + key on page 1,
   notes / venue key / distribution / signature flowing after it (2 pages in total). */

const FONT = "Calibri";
const C = { navy: "0B2545", navy2: "16365F", teal: "0E7C7B", ink: "1E293B", mute: "64748B", line: "CBD5E1", soft: "F5F7FA", venue: "E8EEF4" };
const CAT: Record<Category, { fill: string; text: string; bar: string | null }> = {
  comp: { fill: "D7EFEC", text: "0A4F4C", bar: "0E7C7B" },
  sci: { fill: "E3EBF7", text: "1F3A68", bar: "3B6FB6" },
  gen: { fill: "FCEFD2", text: "6E4300", bar: "D99A1E" },
  act: { fill: "ECE6F7", text: "44337A", bar: "7B61B8" },
  pt: { fill: "EEF1F4", text: "5B6676", bar: null },
  shared: { fill: "FFFFFF", text: "FFFFFF", bar: null },
};
const TIMES = ["8–9", "9–10", "10–11", "11–12", "12–1", "1–2", "2:30–3:30", "3:30–4:30", "4:30–5:30", "5:30–6:30"];

const W = { venue: 1000, day: 700, brk: 520, slot: 1361 };
const TW = W.venue + W.day + W.brk + 10 * W.slot;
const thin = { style: BorderStyle.SINGLE, size: 4, color: C.line };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const heavy = { style: BorderStyle.SINGLE, size: 12, color: C.navy };
const noBorders = { top: none, bottom: none, left: none, right: none };
const MARG = { top: 10, bottom: 10, left: 40, right: 40 };

type B = { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
const borders = (o: Partial<Record<"top" | "bottom" | "left" | "right", B>> = {}) => ({
  top: o.top ?? thin,
  bottom: o.bottom ?? thin,
  left: o.left ?? thin,
  right: o.right ?? thin,
});

const R = (text: string, o: { size?: number; bold?: boolean; italics?: boolean; color?: string; cs?: number } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 14, bold: o.bold, italics: o.italics, color: o.color ?? C.ink, characterSpacing: o.cs });

const P = (children: TextRun[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; line?: number } = {}) =>
  new Paragraph({ alignment: o.align ?? AlignmentType.CENTER, spacing: { before: 0, after: 0, line: o.line ?? 220 }, children });

/* ---------- timetable ---------- */

function headerRows() {
  const hc = (
    text: string | string[],
    o: { w: number; span?: number; rs?: number; size?: number; fill?: string; color?: string; cs?: number },
  ) =>
    new TableCell({
      width: { size: o.w, type: WidthType.DXA },
      columnSpan: o.span,
      rowSpan: o.rs,
      shading: { type: ShadingType.CLEAR, color: "auto", fill: o.fill ?? C.navy },
      verticalAlign: VerticalAlign.CENTER,
      margins: MARG,
      borders: borders({
        top: { style: BorderStyle.SINGLE, size: 4, color: o.fill ?? C.navy },
        left: { style: BorderStyle.SINGLE, size: 4, color: "3A5578" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "3A5578" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "3A5578" },
      }),
      children: (Array.isArray(text) ? text : [text]).map((t) => P([R(t, { size: o.size ?? 14, bold: true, color: o.color ?? "FFFFFF", cs: o.cs })])),
    });
  return [
    new TableRow({
      tableHeader: true,
      height: { value: 260, rule: HeightRule.ATLEAST },
      children: [
        hc("VENUE", { w: W.venue, rs: 2, size: 13, cs: 20 }),
        hc("DAY", { w: W.day, rs: 2, size: 13, cs: 20 }),
        hc("MORNING  ·  a.m.", { w: 6 * W.slot, span: 6, cs: 30 }),
        hc(["BREAK", "2–2:30"], { w: W.brk, rs: 2, size: 10, fill: C.teal }),
        hc("AFTERNOON  ·  p.m.", { w: 4 * W.slot, span: 4, cs: 30 }),
      ],
    }),
    new TableRow({
      tableHeader: true,
      height: { value: 240, rule: HeightRule.ATLEAST },
      children: TIMES.map((t) => hc(t, { w: W.slot, size: 13, fill: C.navy2, color: "E2E8F0" })),
    }),
  ];
}

function emptyCell(span: number, first: boolean) {
  return new TableCell({
    width: { size: span * W.slot, type: WidthType.DXA },
    columnSpan: span > 1 ? span : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: MARG,
    borders: borders({ top: first ? heavy : thin }),
    children: [P([R("", { size: 13 })])],
  });
}

function courseCell(cell: PrintCell, first: boolean) {
  const c = CAT[cell.category];
  let runs: TextRun[];
  if (cell.category === "pt") runs = [R(cell.text, { size: 12, bold: true, color: c.text, cs: 20 })];
  else if (cell.italic) runs = [R(cell.text, { size: 13, italics: true, bold: true, color: c.text })];
  else if (cell.text.includes("/") && cell.span === 1) {
    // Paired codes in one hour: put them on two lines so they fit.
    const parts = cell.text.split("/");
    runs = parts.flatMap((p, i) => [R(p.trim() + (i < parts.length - 1 ? " /" : ""), { size: 13, bold: true, color: c.text }), ...(i < parts.length - 1 ? [new TextRun({ break: 1 })] : [])]);
  } else runs = [R(cell.text.replace(/\//g, " / "), { size: 14, bold: true, color: c.text })];
  return new TableCell({
    width: { size: cell.span * W.slot, type: WidthType.DXA },
    columnSpan: cell.span > 1 ? cell.span : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: MARG,
    borders: borders({ top: first ? heavy : thin, left: c.bar ? { style: BorderStyle.SINGLE, size: 18, color: c.bar } : thin }),
    shading: { type: ShadingType.CLEAR, color: "auto", fill: c.fill },
    children: [P(runs)],
  });
}

function bodyRows(data: TimetableData) {
  const out: TableRow[] = [];
  for (const pv of printLayout(data)) {
    pv.rows.forEach((row, di) => {
      const first = di === 0;
      const cells: TableCell[] = [];
      if (first) {
        cells.push(
          new TableCell({
            width: { size: W.venue, type: WidthType.DXA },
            rowSpan: pv.rows.length,
            verticalAlign: VerticalAlign.CENTER,
            margins: MARG,
            borders: borders({ top: heavy }),
            shading: { type: ShadingType.CLEAR, color: "auto", fill: C.venue },
            children: [P([R(pv.venue.code, { size: 30, bold: true, color: C.navy })]), P([R(`${pv.venue.seats} seats`, { size: 11, color: C.mute })])],
          }),
        );
      }
      cells.push(
        new TableCell({
          width: { size: W.day, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          margins: MARG,
          borders: borders({ top: first ? heavy : thin }),
          shading: { type: ShadingType.CLEAR, color: "auto", fill: C.soft },
          children: [P([R(DAYS[row.day], { size: 14, bold: true, color: C.navy, cs: 10 })])],
        }),
      );
      const emit = (lo: number, hi: number) => {
        let s = lo;
        for (const cell of row.cells.filter((c) => c.start >= lo && c.start <= hi)) {
          if (cell.start > s) cells.push(...gap(cell.start - s, first));
          cells.push(courseCell(cell, first));
          s = cell.start + cell.span;
        }
        if (s <= hi) cells.push(...gap(hi - s + 1, first));
      };
      emit(0, 5);
      if (first) {
        cells.push(
          new TableCell({
            width: { size: W.brk, type: WidthType.DXA },
            rowSpan: pv.rows.length,
            verticalAlign: VerticalAlign.CENTER,
            textDirection: TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT,
            margins: MARG,
            borders: borders({ top: heavy, left: { style: BorderStyle.SINGLE, size: 4, color: C.teal }, right: { style: BorderStyle.SINGLE, size: 4, color: C.teal } }),
            shading: { type: ShadingType.CLEAR, color: "auto", fill: C.teal },
            children: [P([R("BREAK", { size: 12, bold: true, color: "FFFFFF", cs: 60 })])],
          }),
        );
      }
      emit(6, 9);
      out.push(new TableRow({ cantSplit: true, height: { value: 255, rule: HeightRule.ATLEAST }, children: cells }));
    });
  }
  return out;
}

/** Empty slots, one cell each (keeps the grid lines visible). */
const gap = (n: number, first: boolean) => Array.from({ length: n }, () => emptyCell(1, first));

function legend() {
  const chip = (cat: Category, label: string) => {
    const c = CAT[cat];
    return [
      new TableCell({
        width: { size: 260, type: WidthType.DXA },
        borders: { ...noBorders, left: c.bar ? { style: BorderStyle.SINGLE, size: 18, color: c.bar } : none },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: c.fill },
        children: [P([R("", { size: 12 })])],
      }),
      new TableCell({
        width: { size: 2600, type: WidthType.DXA },
        borders: noBorders,
        margins: { left: 80, right: 60, top: 0, bottom: 0 },
        verticalAlign: VerticalAlign.CENTER,
        children: [P([R(label, { size: 13 })], { align: AlignmentType.LEFT })],
      }),
    ];
  };
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [1100, 260, 2600, 260, 2600, 260, 2600, 260, 2600, 260, 2600],
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 1100, type: WidthType.DXA }, borders: noBorders, verticalAlign: VerticalAlign.CENTER, children: [P([R("KEY", { size: 13, bold: true, color: C.navy, cs: 30 })], { align: AlignmentType.LEFT })] }),
          ...chip("comp", "Faculty of Computing courses"),
          ...chip("sci", "Mathematics & Science courses"),
          ...chip("gen", "General / University courses (GST, ENT, CED)"),
          ...chip("act", "Tutorials & Practicals"),
          ...chip("pt", "Part-time (PT) & Jumat periods"),
        ],
      }),
    ],
  });
}

function titleBlock(data: TimetableData) {
  const logo = Buffer.from(CREST_PNG_BASE64, "base64");
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [1300, 11630, 2900],
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1300, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: noBorders,
            children: [new Paragraph({ children: [new ImageRun({ type: "png", data: logo, transformation: { width: 56, height: 54 }, altText: { title: "UNIBEN crest", description: "University of Benin crest", name: "crest" } })] })],
          }),
          new TableCell({
            width: { size: 11630, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: noBorders,
            children: [
              P([R(T.university, { size: 15, bold: true, color: C.mute, cs: 40 })], { align: AlignmentType.LEFT, line: 240 }),
              P([R(T.faculty, { size: 36, bold: true, color: C.navy, cs: 20 })], { align: AlignmentType.LEFT, line: 400 }),
              P([R(`${data.semester?.name ?? ""} ${T.title}`.trim(), { size: 19, bold: true, color: C.teal })], { align: AlignmentType.LEFT, line: 260 }),
            ],
          }),
          new TableCell({
            width: { size: 2900, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.CLEAR, color: "auto", fill: C.navy },
            margins: { top: 50, bottom: 50, left: 120, right: 120 },
            borders: { ...noBorders, left: { style: BorderStyle.SINGLE, size: 36, color: C.teal } },
            children: [
              P([R("SESSION", { size: 12, color: "9FB3C8", bold: true, cs: 40 })]),
              P([R(data.semester?.session ?? "", { size: 30, bold: true, color: "FFFFFF" })], { line: 340 }),
              P([R((data.semester?.name ?? "").toUpperCase(), { size: 12, color: "5FD4C8", bold: true, cs: 40 })]),
            ],
          }),
        ],
      }),
    ],
  });
}

/* ---------- page 2 ---------- */

const H = (t: string) =>
  new Paragraph({ spacing: { before: 120, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.teal, space: 2 } }, children: [R(t, { size: 20, bold: true, color: C.navy, cs: 30 })] });
const Tx = (runs: TextRun[], o: { after?: number; before?: number; keepNext?: boolean } = {}) =>
  new Paragraph({ keepNext: o.keepNext, spacing: { before: o.before ?? 0, after: o.after ?? 60, line: 260 }, children: runs });

function notesAndKey(data: TimetableData) {
  const notes = new Table({
    width: { size: 7520, type: WidthType.DXA },
    columnWidths: [520, 7000],
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: T.notes.map(
      (n, i) =>
        new TableRow({
          children: [
            new TableCell({ width: { size: 520, type: WidthType.DXA }, borders: noBorders, margins: { top: 40, bottom: 40 }, children: [new Paragraph({ children: [R(String(i + 1).padStart(2, "0"), { size: 22, bold: true, color: C.teal })] })] }),
            new TableCell({ width: { size: 7000, type: WidthType.DXA }, borders: noBorders, margins: { top: 40, bottom: 60 }, children: [Tx([R(n, { size: 18 })], { after: 0 })] }),
          ],
        }),
    ),
  });
  const kc = (t: string, w: number, o: { fill?: string; color?: string; bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: o.fill ?? "FFFFFF" },
      borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 4, color: C.line } },
      children: [P([R(t, { size: o.size ?? 17, bold: o.bold, color: o.color ?? C.ink })], { align: o.align ?? AlignmentType.LEFT })],
    });
  const keyTbl = new Table({
    width: { size: 7300, type: WidthType.DXA },
    columnWidths: [1100, 5100, 1100],
    rows: [
      new TableRow({
        children: [
          kc("CODE", 1100, { fill: C.navy, color: "FFFFFF", bold: true, size: 15 }),
          kc("VENUE", 5100, { fill: C.navy, color: "FFFFFF", bold: true, size: 15 }),
          kc("SEATS", 1100, { fill: C.navy, color: "FFFFFF", bold: true, size: 15, align: AlignmentType.CENTER }),
        ],
      }),
      ...data.venues.map(
        (v) =>
          new TableRow({
            children: [kc(v.code, 1100, { bold: true, color: C.teal, size: 20 }), kc(v.name, 5100), kc(String(v.seats), 1100, { align: AlignmentType.CENTER, color: C.mute })],
          }),
      ),
    ],
  });
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [7820, 710, 7300],
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({ width: { size: 7820, type: WidthType.DXA }, borders: noBorders, children: [H("NOTE THE FOLLOWING"), notes, Tx([R("PT", { size: 18, bold: true, color: C.teal }), R(` ${T.ptNote}`, { size: 18 })], { before: 60 })] }),
          new TableCell({ width: { size: 710, type: WidthType.DXA }, borders: noBorders, children: [new Paragraph({ children: [] })] }),
          new TableCell({ width: { size: 7300, type: WidthType.DXA }, borders: noBorders, children: [H("KEY TO VENUE ALLOCATION"), keyTbl] }),
        ],
      }),
    ],
  });
}

function distribution() {
  const cc = (t: string) => new Paragraph({ spacing: { after: 30, line: 240 }, indent: { left: 200, hanging: 200 }, children: [R("▸ ", { size: 14, color: C.teal }), R(t, { size: 17 })] });
  return new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: [7820, 710, 7300],
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({ width: { size: 7820, type: WidthType.DXA }, borders: noBorders, children: [Tx([R(T.distributionTo, { size: 18, bold: true })]), Tx([R("cc:", { size: 17, bold: true, color: C.teal })], { after: 30 }), ...T.ccLeft.map(cc)] }),
          new TableCell({ width: { size: 710, type: WidthType.DXA }, borders: noBorders, children: [new Paragraph({ children: [] })] }),
          new TableCell({ width: { size: 7300, type: WidthType.DXA }, borders: noBorders, children: [Tx([R(" ", { size: 18 })]), Tx([R("cc:", { size: 17, bold: true, color: C.teal })], { after: 30 }), ...T.ccRight.map(cc)] }),
        ],
      }),
    ],
  });
}

function signature(date: string) {
  return [
    new Paragraph({ keepNext: true, spacing: { before: 160, after: 0 }, children: [R(`Signed (${date})`, { size: 17, italics: true, color: C.mute })] }),
    new Paragraph({ keepNext: true, spacing: { before: 300, after: 40 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: C.navy, space: 4 } }, indent: { right: 11500 }, children: [R(T.signatory.name, { size: 20, bold: true, color: C.navy })] }),
    Tx([R(T.signatory.role, { size: 17 })], { after: 0, keepNext: true }),
    Tx([R(T.signatory.forWhom, { size: 17, italics: true, color: C.mute })]),
  ];
}

export async function buildTimetableDocx(data: TimetableData, opts: { date?: Date } = {}): Promise<Buffer> {
  const sessionLabel = data.semester ? `${data.semester.name} Lecture Time-Table ${data.semester.session}` : "Lecture Time-Table";
  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TW }],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 4 } },
        children: [
          R("Faculty of Computing  ·  University of Benin", { size: 14, color: C.mute, bold: true }),
          R(`\t${sessionLabel}   |   Page `, { size: 14, color: C.mute }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: C.navy, bold: true }),
          R(" of ", { size: 14, color: C.mute }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14, color: C.navy, bold: true }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: "Faculty of Computing, University of Benin",
    title: sessionLabel,
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
            margin: { top: 380, bottom: 380, left: 500, right: 500, footer: 220, header: 200 },
          },
        },
        footers: { default: footer },
        children: [
          titleBlock(data),
          new Paragraph({ spacing: { before: 40, after: 70 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.teal, space: 1 } }, children: [] }),
          new Table({
            width: { size: TW, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [W.venue, W.day, ...Array(6).fill(W.slot), W.brk, ...Array(4).fill(W.slot)],
            rows: [...headerRows(), ...bodyRows(data)],
          }),
          new Paragraph({ spacing: { before: 0, after: 0, line: 120 }, children: [] }),
          legend(),
          new Paragraph({ spacing: { before: 0, after: 0, line: 120 }, children: [R("", { size: 4 })] }),
          notesAndKey(data),
          H("DISTRIBUTION"),
          distribution(),
          ...signature(signedDate(opts.date)),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
