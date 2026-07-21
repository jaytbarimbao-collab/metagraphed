import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { AppShell } from "@/components/metagraphed/app-shell";
import { ApiSourceFooter } from "@/components/metagraphed/api-source-footer";
import { EmptyState, Skeleton } from "@/components/metagraphed/states";
import { PageHero, ShareButton, ActionBar } from "@jsonbored/ui-kit";
import { QueryErrorBoundary } from "@/components/metagraphed/error-boundary";
import { domainsQuery } from "@/lib/metagraphed/queries";
import { formatNumber, formatTao } from "@/lib/metagraphed/format";
import { API_BASE } from "@/lib/metagraphed/config";
import { formatDomainLabel, formatEmissionShare } from "@/lib/metagraphed/domains";
import type { DomainRollup } from "@/lib/metagraphed/types";

export const Route = createFileRoute("/domains/")({
  head: () => ({
    meta: [
      { title: "Domains — Metagraphed" },
      {
        name: "description",
        content:
          "Per-domain rollup across the Bittensor capability-tag taxonomy — every domain's member-subnet count, total stake, emission share, and within-domain emission concentration.",
      },
      { property: "og:title", content: "Domains — Metagraphed" },
      {
        property: "og:description",
        content:
          "Browse Bittensor subnets by capability domain, with real stake and emission context per domain.",
      },
    ],
  }),
  component: DomainsPage,
});

function DomainsPage() {
  return (
    <AppShell>
      <PageHero
        eyebrow="Taxonomy"
        live
        title="Domains"
        description="Every capability tag in the Bittensor taxonomy, rolled up over its member subnets — count, total stake, emission share, and within-domain emission concentration. Open a domain to browse its subnets."
        actions={
          <ActionBar>
            <ShareButton bare />
          </ActionBar>
        }
      />
      <QueryErrorBoundary>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <DomainsContent />
        </Suspense>
      </QueryErrorBoundary>
      <ApiSourceFooter paths={["/api/v1/domains"]} artifacts={["/metagraph/domains.json"]} />
    </AppShell>
  );
}

function DomainsContent() {
  const { data: res } = useSuspenseQuery(domainsQuery());
  const rollup = res.data;
  // Rank by emission share (highest first) — the same "most economically
  // significant first" default the /subnets and /validators tables use.
  const rows = [...rollup.domains].sort(
    (a, b) => (b.total_emission_share ?? 0) - (a.total_emission_share ?? 0),
  );
  const totalSubnets = rows.reduce((sum, d) => sum + (d.subnet_count ?? 0), 0);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No domains available"
        description="The taxonomy rollup returned no domains — the source artifact may be temporarily unavailable."
        lastChecked={res.meta?.generated_at ?? undefined}
        action={{
          label: "Open /api/v1/domains",
          href: `${API_BASE}/api/v1/domains`,
          external: true,
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="font-mono text-[11px] text-ink-muted">
        {formatNumber(rows.length)} domains · {formatNumber(totalSubnets)} subnet memberships
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface/50 text-[10px] font-mono uppercase tracking-widest text-ink-muted">
            <tr>
              <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest">
                Domain
              </th>
              <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest">
                Subnets
              </th>
              <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest">
                Total stake
              </th>
              <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest">
                Emission share
              </th>
              <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-widest">
                Concentration
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((d) => (
              <tr key={d.domain} className="mg-row-accent hover:bg-surface/40">
                <td className="px-4 py-2.5">
                  <Link
                    to="/domains/$tag"
                    params={{ tag: d.domain }}
                    className="font-medium text-ink-strong hover:underline"
                  >
                    {formatDomainLabel(d.domain)}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-ink">
                  {formatNumber(d.subnet_count)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-ink">
                  {formatTao(d.total_stake_tao)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-ink">
                  {formatEmissionShare(d.total_emission_share)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <ConcentrationCell domain={d} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 sm:grid-cols-2 md:hidden">
        {rows.map((d) => (
          <Link
            key={d.domain}
            to="/domains/$tag"
            params={{ tag: d.domain }}
            className="block rounded border border-border bg-card p-3 min-h-11 active:bg-surface"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-ink-strong">{formatDomainLabel(d.domain)}</span>
              <span className="font-mono text-[11px] text-ink-muted">
                {formatNumber(d.subnet_count)} subnets
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px] tabular-nums text-ink-muted">
              <span title="Total stake">{formatTao(d.total_stake_tao)}</span>
              <span title="Emission share" className="text-right">
                {formatEmissionShare(d.total_emission_share)}
              </span>
              <span title="Nakamoto coefficient" className="text-right">
                <ConcentrationCell domain={d} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact within-domain emission-concentration indicator: the Nakamoto
 * coefficient (how many subnets hold >50% of the domain's emission) with the
 * Gini as a secondary read. Both fall back to an em-dash for a domain whose
 * concentration wasn't computed (e.g. a single-holder tag).
 */
function ConcentrationCell({ domain }: { domain: DomainRollup }) {
  const c = domain.emission_concentration;
  const nakamoto = c?.nakamoto_coefficient ?? null;
  const gini = c?.gini ?? null;
  return (
    <span
      className="inline-flex flex-col items-end gap-0.5"
      title="Nakamoto coefficient — the fewest member subnets that together hold over 50% of the domain's emission (lower is more concentrated). Gini shown below."
    >
      <span className="font-mono text-[12px] tabular-nums text-ink-strong">
        {nakamoto != null ? `${formatNumber(nakamoto)} nakamoto` : "—"}
      </span>
      <span className="font-mono text-[10px] tabular-nums text-ink-muted">
        {gini != null ? `gini ${gini.toFixed(2)}` : "—"}
      </span>
    </span>
  );
}
