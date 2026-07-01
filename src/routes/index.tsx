import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchLeaderboard } from "../lib/upfluence.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Top Creators by Industry — Upfluence" },
      {
        name: "description",
        content:
          "A real-time leaderboard of the top 10 creators across Beauty, Fashion, Fitness, Food, and Gaming, powered by the Upfluence API.",
      },
    ],
  }),
  component: DashboardPage,
});

type IndustryKey = "beauty" | "fashion" | "fitness" | "food" | "gaming";

const INDUSTRIES: { key: IndustryKey; label: string; emoji: string }[] = [
  { key: "beauty", label: "Beauty", emoji: "💄" },
  { key: "fashion", label: "Fashion", emoji: "👗" },
  { key: "fitness", label: "Fitness", emoji: "🏋️" },
  { key: "food", label: "Food", emoji: "🍜" },
  { key: "gaming", label: "Gaming", emoji: "🎮" },
];

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function DashboardPage() {
  const [industry, setIndustry] = useState<IndustryKey>("beauty");

  const query = useQuery({
    queryKey: ["leaderboard", industry],
    queryFn: () => fetchLeaderboard({ data: { industry } }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <IndustryTabs value={industry} onChange={setIndustry} />
        <MethodologyStrip />

        <section className="mt-8">
          {query.isLoading && <LoadingState />}
          {query.isError && (
            <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
          )}
          {query.data && (
            <>
              <InsightCard insight={query.data.insight} fetchedAt={query.data.fetched_at} />
              <CreatorList creators={query.data.creators} />
              {query.data.creators.length === 0 && (
                <p className="mt-6 text-sm text-muted-foreground">
                  No qualifying creators returned by the Upfluence API for this query.
                </p>
              )}
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <span className="text-sm font-bold">Up</span>
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              Top Creators by Industry
            </h1>
            <p className="text-xs text-muted-foreground">
              Live data · Upfluence Public API
            </p>
          </div>
        </div>
        <a
          href="https://docs.upfluence.co"
          target="_blank"
          rel="noreferrer"
          className="hidden text-xs font-medium text-primary hover:underline sm:inline"
        >
          API Docs ↗
        </a>
      </div>
    </header>
  );
}

function IndustryTabs({
  value,
  onChange,
}: {
  value: IndustryKey;
  onChange: (v: IndustryKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {INDUSTRIES.map((i) => {
        const active = i.key === value;
        return (
          <button
            key={i.key}
            onClick={() => onChange(i.key)}
            className={
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all " +
              (active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-white text-foreground hover:border-primary/40 hover:bg-secondary")
            }
          >
            <span aria-hidden>{i.emoji}</span>
            {i.label}
          </button>
        );
      })}
    </div>
  );
}

function MethodologyStrip() {
  const signals: { name: string; weight: number; desc: string }[] = [
    { name: "Reach", weight: 25, desc: "Instagram followers (log-scaled)" },
    { name: "Engagement", weight: 30, desc: "Avg. engagement rate on IG" },
    { name: "Resonance", weight: 15, desc: "Avg. video views ÷ followers" },
    { name: "Relevance", weight: 20, desc: "Match to industry categories" },
    { name: "Professionalism", weight: 10, desc: "Verified · contactable · growing" },
  ];
  return (
    <div className="mt-6 rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Ranking methodology</h2>
        <span className="text-xs text-muted-foreground">
          Composite score, 0–100 · higher is better
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {signals.map((s) => (
          <div
            key={s.name}
            className="rounded-xl border border-border bg-secondary/50 p-3"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-primary">{s.name}</span>
              <span className="text-xs font-mono text-muted-foreground">
                {s.weight}%
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {s.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightCard({ insight, fetchedAt }: { insight: string; fetchedAt: number }) {
  const date = new Date(fetchedAt);
  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2 text-[10px] font-semibold uppercase tracking-wider text-primary">
          Brand insight
        </span>
        <span className="text-[11px] text-muted-foreground">
          Refreshed {date.toLocaleTimeString()}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{insight}</p>
    </div>
  );
}

function CreatorList({ creators }: { creators: any[] }) {
  return (
    <div className="space-y-3">
      {creators.map((c) => (
        <CreatorRow key={c.influencer_id} creator={c} />
      ))}
    </div>
  );
}

function CreatorRow({ creator }: { creator: any }) {
  const ig = creator.instagram;
  return (
    <article className="group grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:grid-cols-[auto_1fr_auto]">
      {/* Rank + avatar */}
      <div className="flex items-center gap-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
          {creator.rank}
        </div>
        <div className="relative">
          {creator.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creator.avatar_url}
              alt={creator.name}
              className="h-14 w-14 rounded-full border border-border object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-secondary" />
          )}
          {ig?.verified && (
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground shadow">
              ✓
            </span>
          )}
        </div>
      </div>

      {/* Identity + metrics */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold tracking-tight">{creator.name}</h3>
          {ig && (
            <a
              href={ig.profile_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-primary hover:underline"
            >
              @{ig.username} ↗
            </a>
          )}
          {creator.country && (
            <span className="text-[11px] uppercase text-muted-foreground">
              {creator.country}
            </span>
          )}
        </div>
        {creator.bio && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {creator.bio}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {creator.categories.map((cat: string) => (
            <span
              key={cat}
              className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
            >
              {cat}
            </span>
          ))}
        </div>
        {ig && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Followers" value={formatCount(ig.followers)} />
            <Metric
              label="Engagement"
              value={`${ig.engagement_rate.toFixed(2)}%`}
            />
            <Metric label="Avg. likes" value={formatCount(Math.round(ig.average_likes))} />
            <Metric label="Avg. views" value={formatCount(Math.round(ig.average_views))} />
          </div>
        )}
      </div>

      {/* Score */}
      <div className="col-span-2 flex items-center justify-between border-t border-border pt-4 sm:col-span-1 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Composite
          </div>
          <div className="font-mono text-3xl font-bold text-primary">
            {creator.composite_score.toFixed(1)}
          </div>
        </div>
        <SignalBars signals={creator.signals} />
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

function SignalBars({ signals }: { signals: Record<string, number> }) {
  const entries: [string, string][] = [
    ["reach", "R"],
    ["engagement", "E"],
    ["resonance", "V"],
    ["relevance", "C"],
    ["professionalism", "P"],
  ];
  return (
    <div className="mt-2 flex items-end gap-1 sm:mt-3">
      {entries.map(([k, letter]) => {
        const v = signals[k] ?? 0;
        return (
          <div key={k} className="flex flex-col items-center gap-0.5" title={`${k}: ${v.toFixed(0)}`}>
            <div className="relative h-10 w-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="absolute bottom-0 left-0 right-0 bg-primary"
                style={{ height: `${Math.max(2, Math.min(100, v))}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground">
              {letter}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-2xl border border-border bg-secondary/50"
        />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <h3 className="text-sm font-semibold text-destructive">Couldn't load data</h3>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 rounded-md border border-destructive/40 bg-white px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
      >
        Try again
      </button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
        Built with the Upfluence Public API. Rankings are computed on-the-fly from
        live creator signals and cached briefly to respect API rate limits.
      </div>
    </footer>
  );
}
