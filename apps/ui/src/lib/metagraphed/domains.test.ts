import { describe, expect, it } from "vitest";
import { formatDomainLabel, formatEmissionShare, formatRatioPct } from "./domains";

describe("formatDomainLabel", () => {
  it("Title-cases a single-word tag", () => {
    expect(formatDomainLabel("agents")).toBe("Agents");
    expect(formatDomainLabel("inference")).toBe("Inference");
  });

  it("Title-cases each word of a multi-word / delimited tag", () => {
    expect(formatDomainLabel("data-science")).toBe("Data Science");
    expect(formatDomainLabel("machine_learning")).toBe("Machine Learning");
  });

  it("returns an em-dash for a blank/nullish tag", () => {
    expect(formatDomainLabel("")).toBe("—");
    expect(formatDomainLabel(null)).toBe("—");
    expect(formatDomainLabel(undefined)).toBe("—");
  });
});

describe("formatEmissionShare", () => {
  it("renders a 0..1 fraction as a two-decimal percentage", () => {
    expect(formatEmissionShare(0.071288)).toBe("7.13%");
    expect(formatEmissionShare(0.002769)).toBe("0.28%");
    expect(formatEmissionShare(0)).toBe("0.00%");
  });

  it("renders an em-dash for nullish/non-finite input", () => {
    expect(formatEmissionShare(null)).toBe("—");
    expect(formatEmissionShare(undefined)).toBe("—");
    expect(formatEmissionShare(Number.NaN)).toBe("—");
  });
});

describe("formatRatioPct", () => {
  it("defaults to one decimal", () => {
    expect(formatRatioPct(0.398272)).toBe("39.8%");
  });

  it("honors a custom precision", () => {
    expect(formatRatioPct(0.922427, 2)).toBe("92.24%");
  });

  it("renders an em-dash for nullish/non-finite input", () => {
    expect(formatRatioPct(null)).toBe("—");
    expect(formatRatioPct(Number.NaN)).toBe("—");
  });
});
