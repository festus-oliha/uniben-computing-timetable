import { describe, expect, it } from "vitest";
import { fitSignature, formatSignedDate, imageTypeOf, validateSignoff } from "./signoff";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("sign-off", () => {
  it("formats the signing date the faculty way", () => {
    expect(formatSignedDate("2026-09-08")).toBe("08/09/2026");
    expect(formatSignedDate(null)).toBeNull();
    expect(formatSignedDate("8/9/2026")).toBeNull();
  });

  it("accepts a date with or without a signature", () => {
    expect(validateSignoff({ signedOn: "2026-09-08", image: null, width: null, height: null })).toBeNull();
    expect(validateSignoff({ signedOn: "2026-09-08", image: PNG, width: 400, height: 120 })).toBeNull();
  });

  it("rejects impossible dates and non-image data", () => {
    expect(validateSignoff({ signedOn: "2026-02-30", image: null, width: null, height: null })).toMatch(/date/);
    expect(validateSignoff({ signedOn: null, image: "data:text/html;base64,PGI+", width: 10, height: 10 })).toMatch(/PNG or JPEG/);
  });

  it("rejects oversized images", () => {
    const big = "data:image/png;base64," + "A".repeat(500_000);
    expect(validateSignoff({ signedOn: null, image: big, width: 900, height: 300 })).toMatch(/too large/);
  });

  it("fits a signature into the printed box without stretching it", () => {
    expect(fitSignature(600, 200, 180, 60)).toEqual({ width: 180, height: 60 });
    expect(fitSignature(400, 400, 180, 60)).toEqual({ width: 60, height: 60 });
    expect(fitSignature(100, 30, 180, 60)).toEqual({ width: 100, height: 30 });
  });

  it("detects the image type", () => {
    expect(imageTypeOf(PNG)).toBe("png");
    expect(imageTypeOf("data:image/jpeg;base64,/9j/")).toBe("jpg");
  });
});
