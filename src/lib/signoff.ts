/** Sign-off rules shared by the server action, the exports and the tests. */

export interface Signoff {
  /** YYYY-MM-DD, or null when no date has been set. */
  signedOn: string | null;
  /** PNG or JPEG data URL, or null when no signature has been added. */
  image: string | null;
  width: number | null;
  height: number | null;
}

export const EMPTY_SIGNOFF: Signoff = { signedOn: null, image: null, width: null, height: null };

/** Largest signature we store (as a data URL). Drawn signatures are ~10–40 KB. */
export const MAX_SIGNATURE_BYTES = 400_000;

const DATA_URL_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

/** "2026-09-08" → "08/09/2026" (the faculty's date style). Returns null for anything else. */
export function formatSignedDate(iso: string | null | undefined): string | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

export function isValidIsoDate(iso: string): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Checks a sign-off before saving. Returns an error message, or null when it's fine. */
export function validateSignoff(s: Signoff): string | null {
  if (s.signedOn && !isValidIsoDate(s.signedOn)) return "Pick a valid signing date.";
  if (s.image) {
    if (!DATA_URL_RE.test(s.image)) return "The signature must be a PNG or JPEG image.";
    if (s.image.length > MAX_SIGNATURE_BYTES) return "The signature image is too large. Use a smaller scan (under 300 KB).";
    if (!s.width || !s.height || s.width < 10 || s.height < 10) return "The signature image size couldn't be read. Try again.";
  }
  return null;
}

/** Scales the signature to fit a box, keeping its shape. */
export function fitSignature(width: number, height: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / width, maxH / height, 1);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** "png" or "jpg" from a data URL (what the Word library needs). */
export function imageTypeOf(dataUrl: string): "png" | "jpg" {
  return dataUrl.startsWith("data:image/jpeg") ? "jpg" : "png";
}
