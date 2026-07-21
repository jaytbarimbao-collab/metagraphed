import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft, Coins, Layers, Users, Zap } from "lucide-react";
import { AppShell } from "@/components/metagraphed/app-shell";
import { ApiSourceFooter } from "@/components/metagraphed/api-source-footer";
import { EmptyState, Skeleton } from "@/components/metagraphed/states";
import { PageHero, ShareButton, ActionBar, StatTile, BrandIcon } from "@jsonbored/ui-kit";
import { QueryErrorBoundary } from "@/components/metagraphed/error-boundary";
import { domainSummaryQuery, subnetsQuery } from "@/lib/metagraphed/queries";
import { formatNumber, formatTao } from "@/lib/metagraphed/format";
import { API_BASE } from "@/lib/metagraphed/config";
import { formatDomainLabel, formatEmissionShare, formatRatioPct } from "@/lib/metagraphed/domains";
import type { Subnet } from "@/lib/metagraphed/types";

export const Route = createFileRoute("/domains/$tag")({
  head: ({ params }) => {
    const label = formatDomainLabel(params.tag);
    const title = `${label} — Domain — Metagraphed`;
    const description = `${label}: member subnets, total stake, emission share, and within-domain emission concentration for the ${params.tag} capability domain on Bittensor.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: DomainDetailPage,
});

function DomainDetailPage() {
  const { tag } = Route.useParams();
  return (
    <AppShell>
      <PageHero
        eyebrow="Domain"
        live
        title={formatDomainLabel(tag)}
        description={`Capability-domain rollup for “${tag}” — its member subnets and the economics aggregated across them.`}
        actions={
          <ActionBar>
            <ShareButton bare />
          </ActionBar>
        }
      />
      <div className="mb-4">
        <Link
          to="/domains"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-muted hover:text-ink-strong"
        >
          <ArrowLeft className="size-3" /> All domains
        </Link>
      </div>
      <QueryErrorBoundary>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <DomainDetailContent tag={tag} />
        </Suspense>
      </QueryErrorBoundary>
      <ApiSourceFooter paths={[`/api/v1/domains/${tag}/summary`]} />
    </AppShell>
  );
}

function DomainDetailContent({ tag }: { tag: string }) {
  const { data: res } = useSuspenseQuery(domainSummaryQuery(tag));
  const domain = res.data;

  if (!domain) {
    return (
      <EmptyState
        title="Domain not found"
        description={`“${tag}” isn't a capability tag in the taxonomy. Browse the full list to find a valid domain.`}
        action={{ label: "Back to all domains", href: "/domains" }}
      />
    );
  }

  const c = domain.emission_concentration;

  return (
    <div className="space-y-8">
      {/* Headline stats */}
      <div className="flex flex-wrap gap-3 [&>*]:grow [&>*]:basis-[160px]">
        <StatTile
          icon={Layers}
          eyebrow="Member subnets"
          value={formatNumber(domain.subnet_count)}
        />
        <StatTile
          icon={Coins}
          eyebrow="Total stake"
          value={formatTao(domain.total_stake_tao)}
          tone="accent"
        />
        <StatTile
          icon={Zap}
          eyebrow="Emission share"
          value={formatEmissionShare(domain.total_emission_share)}
          hint="of network"
        />
        <StatTile
          icon={Users}
          eyebrow="Emission holders"
          value={formatNumber(c?.holders)}
          hint="subnets earning"
        />
      </div>

      {/* Emission concentration */}
      <section>
        <h2 className="mg-label mb-3">Emission concentration</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <KpiTile
            label="Nakamoto"
            value={formatNumber(c?.nakamoto_coefficient)}
            hint="subnets to >50%"
          />
          <KpiTile label="Gini" value={fmt2(c?.gini)} hint="0 even · 1 skewed" />
          <KpiTile label="HHI" value={fmt2(c?.hhi)} hint="Herfindahl-Hirschman" />
          <KpiTile label="HHI (norm.)" value={fmt2(c?.hhi_normalized)} />
          <KpiTile label="Top 1%" value={formatRatioPct(c?.top_1pct_share)} />
          <KpiTile label="Top 5%" value={formatRatioPct(c?.top_5pct_share)} />
          <KpiTile label="Top 10%" value={formatRatioPct(c?.top_10pct_share)} />
          <KpiTile label="Top 20%" value={formatRatioPct(c?.top_20pct_share)} />
          <KpiTile label="Entropy" value={fmt2(c?.entropy)} hint="bits · higher = even" />
          <KpiTile label="Entropy (norm.)" value={formatRatioPct(c?.entropy_normalized)} />
        </div>
      </section>

      {/* Member subnets */}
      <section>
        <h2 className="mg-label mb-3">Member subnets · {formatNumber(domain.netuids.length)}</h2>
        <QueryErrorBoundary>
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <MemberSubnets netuids={domain.netuids} />
          </Suspense>
        </QueryErrorBoundary>
      </section>
    </div>
  );
}

/**
 * Chips for the domain's member netuids, each linking to its subnet profile.
 * Names/icons are enriched best-effort from the already-cached subnets list
 * (same source the homepage rail uses); a netuid with no catalog entry still
 * renders as a working link with its number.
 */
function MemberSubnets({ netuids }: { netuids: number[] }) {
  const { data: subnetsRes } = useSuspenseQuery(subnetsQuery({ limit: 200 }));
  const subnets = (subnetsRes.data ?? []) as Subnet[];
  const byNetuid = new Map<number, Subnet>();
  for (const s of subnets) byNetuid.set(s.netuid, s);

  if (netuids.length === 0) {
    return (
      <EmptyState
        title="No member subnets"
        description="This domain currently has no subnets mapped to it."
      />
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {netuids.map((netuid) => {
        const s = byNetuid.get(netuid);
        const name = s?.name ?? `Subnet ${netuid}`;
        return (
          <Link
            key={netuid}
            to="/subnets/$netuid"
            params={{ netuid }}
            title={`${name} · SN${netuid}`}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-2.5 py-1.5 hover:border-accent/40 transition-colors"
          >
            <BrandIcon
              size={16}
              name={name}
              fallback={netuid}
              url={s?.website}
              repoUrl={s?.repo}
              iconUrl={s?.icon_url}
              netuid={netuid}
            />
            <span className="font-medium text-[12px] text-ink-strong truncate max-w-[140px]">
              {name}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              SN{netuid}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function KpiTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">{label}</div>
      <div className="mt-1 font-mono text-lg text-ink-strong tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-[10px] text-ink-muted">{hint}</div> : null}
    </div>
  );
}

/** Two-decimal display for an unbounded concentration metric (gini/hhi/entropy). */
function fmt2(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(2);
}
