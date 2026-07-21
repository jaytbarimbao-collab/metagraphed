import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "./client";
import { apiFetch } from "./client";
import {
  domainSummaryQuery,
  domainsQuery,
  normalizeDomainRollup,
  normalizeDomainsRollup,
} from "./queries";

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(apiFetch);

// A representative live row (GET /api/v1/domains → data.domains[0]).
const AGENTS = {
  schema_version: 1,
  domain: "agents",
  subnet_count: 11,
  netuids: [1, 6, 11, 15, 62, 66, 74, 98, 115, 118, 121],
  total_stake_tao: 30400330.8314,
  total_emission_share: 0.071288,
  emission_concentration: {
    holders: 11,
    total: 0.0713,
    gini: 0.338088,
    hhi: 0.129248,
    hhi_normalized: 0.042172,
    nakamoto_coefficient: 3,
    top_1pct_share: 0.234275,
    top_5pct_share: 0.234275,
    top_10pct_share: 0.398272,
    top_20pct_share: 0.523244,
    entropy: 3.191075,
    entropy_normalized: 0.922427,
  },
};

describe("normalizeDomainRollup", () => {
  it("passes a well-formed domain row through", () => {
    const d = normalizeDomainRollup(AGENTS);
    expect(d).not.toBeNull();
    expect(d!.domain).toBe("agents");
    expect(d!.subnet_count).toBe(11);
    expect(d!.netuids).toEqual([1, 6, 11, 15, 62, 66, 74, 98, 115, 118, 121]);
    expect(d!.total_stake_tao).toBeCloseTo(30400330.8314);
    expect(d!.total_emission_share).toBeCloseTo(0.071288);
    expect(d!.emission_concentration?.nakamoto_coefficient).toBe(3);
    expect(d!.emission_concentration?.gini).toBeCloseTo(0.338088);
  });

  it("drops a row with no usable domain tag", () => {
    expect(normalizeDomainRollup({ subnet_count: 3 })).toBeNull();
    expect(normalizeDomainRollup(null)).toBeNull();
    expect(normalizeDomainRollup("x")).toBeNull();
  });

  it("degrades absent numeric/concentration fields to null, never NaN", () => {
    const d = normalizeDomainRollup({ domain: "privacy", netuids: [55, 90] });
    expect(d).not.toBeNull();
    expect(d!.subnet_count).toBe(2); // falls back to netuids.length
    expect(d!.total_stake_tao).toBeNull();
    expect(d!.total_emission_share).toBeNull();
    expect(d!.emission_concentration).toBeNull();
  });

  it("filters junk netuids out of the members array", () => {
    const d = normalizeDomainRollup({ domain: "data", netuids: [13, "x", null, 29] });
    expect(d!.netuids).toEqual([13, 29]);
  });
});

describe("normalizeDomainsRollup", () => {
  it("keeps only valid rows and infers domain_count", () => {
    const rollup = normalizeDomainsRollup({
      domains: [AGENTS, { subnet_count: 5 }, { domain: "compute", netuids: [12] }],
    });
    expect(rollup.domains.map((d) => d.domain)).toEqual(["agents", "compute"]);
    expect(rollup.domain_count).toBe(2);
  });

  it("degrades a cold/junk store to a schema-stable empty rollup", () => {
    for (const raw of [{}, null, "x", { domains: "nope" }]) {
      const rollup = normalizeDomainsRollup(raw);
      expect(rollup.domains).toEqual([]);
      expect(rollup.domain_count).toBe(0);
    }
  });
});

describe("domainsQuery", () => {
  beforeEach(() => mockedApiFetch.mockReset());

  it("fetches /api/v1/domains and normalizes the envelope", async () => {
    mockedApiFetch.mockResolvedValue({
      data: { domain_count: 1, domains: [AGENTS] },
      meta: {} as ApiResult<unknown>["meta"],
      url: "/api/v1/domains",
    });
    const opts = domainsQuery();
    if (!opts.queryFn) throw new Error("expected a queryFn");
    const res = await opts.queryFn({
      signal: new AbortController().signal,
      queryKey: opts.queryKey,
      meta: undefined,
    } as unknown as Parameters<NonNullable<typeof opts.queryFn>>[0]);

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/api/v1/domains",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(res.data.domains).toHaveLength(1);
    expect(res.data.domains[0]?.domain).toBe("agents");
  });
});

describe("domainSummaryQuery", () => {
  beforeEach(() => mockedApiFetch.mockReset());

  it("fetches the encoded per-tag summary route and normalizes it", async () => {
    mockedApiFetch.mockResolvedValue({
      data: AGENTS,
      meta: {} as ApiResult<unknown>["meta"],
      url: "/api/v1/domains/agents/summary",
    });
    const opts = domainSummaryQuery("agents");
    if (!opts.queryFn) throw new Error("expected a queryFn");
    const res = await opts.queryFn({
      signal: new AbortController().signal,
      queryKey: opts.queryKey,
      meta: undefined,
    } as unknown as Parameters<NonNullable<typeof opts.queryFn>>[0]);

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/api/v1/domains/agents/summary",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(res.data?.domain).toBe("agents");
    expect(res.data?.subnet_count).toBe(11);
  });

  it("returns null data for a tag outside the taxonomy", async () => {
    mockedApiFetch.mockResolvedValue({
      data: { not: "a domain" },
      meta: {} as ApiResult<unknown>["meta"],
      url: "/api/v1/domains/zzz/summary",
    });
    const opts = domainSummaryQuery("zzz");
    const res = await opts.queryFn!({
      signal: new AbortController().signal,
      queryKey: opts.queryKey,
      meta: undefined,
    } as unknown as Parameters<NonNullable<typeof opts.queryFn>>[0]);
    expect(res.data).toBeNull();
  });
});
