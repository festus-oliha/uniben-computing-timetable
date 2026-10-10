/** The Dean's profile, mission and vision shown on the FaCoMS home page — pure shapes and checks (tested). */

export interface HomeContent {
  dean: {
    name: string;
    /** e.g. "Dean, Faculty of Computing" */
    title: string;
    /** JPEG/PNG data URL, already resized in the browser; null = no photo yet. */
    photo: string | null;
    /** Short profile; blank lines separate paragraphs. */
    profile: string;
  };
  mission: string;
  vision: string;
}

export const EMPTY_HOME: HomeContent = { dean: { name: "", title: "Dean, Faculty of Computing", photo: null, profile: "" }, mission: "", vision: "" };

/** Largest stored photo (as a data URL). The browser resizes to 480 px first, which is usually 30–80 KB. */
export const MAX_PHOTO_BYTES = 600_000;

const PHOTO_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

export function normaliseHome(v: unknown): HomeContent {
  const x = (v ?? {}) as Partial<HomeContent>;
  const d = (x.dean ?? {}) as Partial<HomeContent["dean"]>;
  const s = (t: unknown, max: number) => (typeof t === "string" ? t.trim().slice(0, max) : "");
  return {
    dean: {
      name: s(d.name, 120),
      title: s(d.title, 120) || EMPTY_HOME.dean.title,
      photo: typeof d.photo === "string" && PHOTO_RE.test(d.photo) && d.photo.length <= MAX_PHOTO_BYTES ? d.photo : null,
      profile: s(d.profile, 2500),
    },
    mission: s(x.mission, 1200),
    vision: s(x.vision, 1200),
  };
}

/** A problem with what was typed, or null. */
export function homeProblem(v: HomeContent): string | null {
  if (v.dean.photo && !PHOTO_RE.test(v.dean.photo)) return "The photo must be a JPEG or PNG image.";
  if (v.dean.photo && v.dean.photo.length > MAX_PHOTO_BYTES) return "The photo is too large. Use a smaller picture.";
  if (v.dean.profile.length > 2500) return "Keep the Dean's profile under 2,500 characters.";
  if (v.mission.length > 1200 || v.vision.length > 1200) return "Keep the mission and vision under 1,200 characters each.";
  return null;
}

/** Paragraphs from text with blank lines between them. */
export const paragraphs = (t: string) => t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** Does the home page have anything to show in the Dean / mission section? */
export const hasHomeContent = (v: HomeContent) => !!(v.dean.name || v.dean.profile || v.dean.photo || v.mission || v.vision);
