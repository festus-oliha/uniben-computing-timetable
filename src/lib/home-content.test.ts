import { describe, expect, it } from "vitest";
import { hasHomeContent, homeProblem, normaliseHome, paragraphs } from "./home-content";

describe("home page content", () => {
  it("fills gaps and trims what is stored", () => {
    const h = normaliseHome({ dean: { name: "  Prof. A. B. Dean " }, mission: " To train " });
    expect(h.dean.name).toBe("Prof. A. B. Dean");
    expect(h.dean.title).toBe("Dean, Faculty of Computing");
    expect(h.mission).toBe("To train");
    expect(normaliseHome(null).dean.photo).toBeNull();
  });

  it("only keeps real image data as the photo", () => {
    expect(normaliseHome({ dean: { photo: "javascript:alert(1)" } }).dean.photo).toBeNull();
    expect(normaliseHome({ dean: { photo: "data:image/jpeg;base64,AAAA" } }).dean.photo).toBe("data:image/jpeg;base64,AAAA");
    expect(homeProblem({ ...normaliseHome(null), dean: { ...normaliseHome(null).dean, photo: "data:image/gif;base64,AA" } })).toMatch(/JPEG or PNG/);
  });

  it("splits paragraphs and knows when there is nothing to show", () => {
    expect(paragraphs("One.\n\nTwo.\n  \nThree.")).toEqual(["One.", "Two.", "Three."]);
    expect(hasHomeContent(normaliseHome(null))).toBe(false);
    expect(hasHomeContent(normaliseHome({ mission: "x" }))).toBe(true);
  });
});
