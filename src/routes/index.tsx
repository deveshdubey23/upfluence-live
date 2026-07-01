import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Settings,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  GitCompare,
  Download,
  Heart,
  X,
  Check,
} from "lucide-react";
import * as XLSX from "xlsx";
import upfluenceLogo from "@/assets/upfluence-logo.png.asset.json";
import { fetchLeaderboard } from "../lib/upfluence.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Upfluence — Influencer Pulse" },
      {
        name: "description",
        content:
          "Real-time creator intelligence across Beauty, Fashion, Fitness, Food, and Gaming — powered by the Upfluence API.",
      },
    ],
  }),
  component: DashboardPage,
});

type IndustryKey = "beauty" | "fashion" | "fitness" | "food" | "gaming" | "favourites";
type ReachTier = "all" | "micro" | "mid" | "macro" | "mega";
type SortKey =
  | "composite"
  | "followers"
  | "engagement"
  | "avg_views"
  | "name";

const INDUSTRIES: { key: IndustryKey; label: string; emoji: string }[] = [
  { key: "beauty", label: "Beauty", emoji: "💄" },
  { key: "fashion", label: "Fashion", emoji: "👗" },
  { key: "fitness", label: "Fitness", emoji: "🏋️" },
  { key: "food", label: "Food", emoji: "🍜" },
  { key: "gaming", label: "Gaming", emoji: "🎮" },
  { key: "favourites", label: "Favourites", emoji: "❤️" },
];

const DEFAULT_WEIGHTS = {
  reach: 25,
  engagement: 30,
  resonance: 15,
  relevance: 20,
  professionalism: 10,
};
type Weights = typeof DEFAULT_WEIGHTS;

const SIGNAL_META: { key: keyof Weights; label: string; desc: string }[] = [
  { key: "reach", label: "Reach", desc: "Instagram followers (log-scaled)" },
  { key: "engagement", label: "Engagement", desc: "Avg. engagement rate on IG" },
  { key: "resonance", label: "Resonance", desc: "Avg. video views ÷ followers" },
  { key: "relevance", label: "Relevance", desc: "Match to industry categories" },
  { key: "professionalism", label: "Professionalism", desc: "Verified · contactable · growing" },
];

const REACH_TIERS: { key: ReachTier; label: string; range: string }[] = [
  { key: "all", label: "All tiers", range: "" },
  { key: "micro", label: "Micro", range: "< 100K" },
  { key: "mid", label: "Mid", range: "100K – 500K" },
  { key: "macro", label: "Macro", range: "500K – 1M" },
  { key: "mega", label: "Mega", range: "1M+" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "composite", label: "Composite score" },
  { key: "followers", label: "Followers" },
  { key: "engagement", label: "Engagement rate" },
  { key: "avg_views", label: "Avg. views" },
  { key: "name", label: "Name (A–Z)" },
];

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function reachTierOf(followers: number): ReachTier {
  if (followers >= 1_000_000) return "mega";
  if (followers >= 500_000) return "macro";
  if (followers >= 100_000) return "mid";
  return "micro";
}

// -- localStorage helpers --
const LS_WEIGHTS = "upfluence:weights";
const LS_FAVS = "upfluence:favs";

function loadWeights(): Weights {
  if (typeof window === "undefined") return DEFAULT_WEIGHTS;
  try {
    const raw = localStorage.getItem(LS_WEIGHTS);
    if (raw) return { ...DEFAULT_WEIGHTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_WEIGHTS;
}
function loadFavs(): Record<number, any> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_FAVS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function DashboardPage() {
  const [industry, setIndustry] = useState<IndustryKey>("beauty");
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [favs, setFavs] = useState<Record<number, any>>({});
  const [search, setSearch] = useState("");
  const [reachTier, setReachTier] = useState<ReachTier>("all");
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [showSettings, setShowSettings] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<Record<number, any>>({});
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    setWeights(loadWeights());
    setFavs(loadFavs());
  }, []);

  const persistWeights = (w: Weights) => {
    setWeights(w);
    try { localStorage.setItem(LS_WEIGHTS, JSON.stringify(w)); } catch {}
  };
  const toggleFav = (c: any) => {
    setFavs((prev) => {
      const next = { ...prev };
      if (next[c.influencer_id]) delete next[c.influencer_id];
      else next[c.influencer_id] = c;
      try { localStorage.setItem(LS_FAVS, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const toggleSelect = (c: any) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[c.influencer_id]) delete next[c.influencer_id];
      else next[c.influencer_id] = c;
      return next;
    });
  };

  const query = useQuery({
    queryKey: ["leaderboard", industry],
    queryFn: () => fetchLeaderboard({ data: { industry: industry as any } }),
    staleTime: 5 * 60 * 1000,
    enabled: industry !== "favourites",
  });

  const rawCreators: any[] = useMemo(() => {
    if (industry === "favourites") return Object.values(favs);
    return query.data?.creators ?? [];
  }, [industry, favs, query.data]);

  // Recompute composite with user weights
  const processed = useMemo(() => {
    const wSum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
    const list = rawCreators.map((c) => {
      const s = c.signals || {};
      const composite =
        (s.reach * weights.reach +
          s.engagement * weights.engagement +
          s.resonance * weights.resonance +
          s.relevance * weights.relevance +
          s.professionalism * weights.professionalism) /
        wSum;
      return { ...c, composite_score: Math.round(composite * 10) / 10 };
    });

    // filter
    const q = search.trim().toLowerCase();
    let filtered = list.filter((c) => {
      if (reachTier !== "all") {
        const t = reachTierOf(c.instagram?.followers ?? 0);
        if (t !== reachTier) return false;
      }
      if (q) {
        const hay = `${c.name} ${c.instagram?.username ?? ""} ${(c.categories || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // sort
    filtered.sort((a, b) => {
      switch (sortKey) {
        case "followers":
          return (b.instagram?.followers ?? 0) - (a.instagram?.followers ?? 0);
        case "engagement":
          return (b.instagram?.engagement_rate ?? 0) - (a.instagram?.engagement_rate ?? 0);
        case "avg_views":
          return (b.instagram?.average_views ?? 0) - (a.instagram?.average_views ?? 0);
        case "name":
          return String(a.name).localeCompare(String(b.name));
        default:
          return b.composite_score - a.composite_score;
      }
    });

    return filtered.map((c, i) => ({ ...c, rank: i + 1 }));
  }, [rawCreators, weights, search, reachTier, sortKey]);

  const selectedList = Object.values(selected);

  const exportReport = () => {
    const rows = processed.map((c) => ({
      Rank: c.rank,
      Name: c.name,
      Username: c.instagram?.username ?? "",
      Country: c.country ?? "",
      Followers: c.instagram?.followers ?? 0,
      "Engagement %": c.instagram?.engagement_rate ?? 0,
      "Avg Likes": Math.round(c.instagram?.average_likes ?? 0),
      "Avg Views": Math.round(c.instagram?.average_views ?? 0),
      Verified: c.instagram?.verified ? "Yes" : "No",
      Categories: (c.categories || []).join(", "),
      Reach: c.signals?.reach?.toFixed(1),
      Engagement: c.signals?.engagement?.toFixed(1),
      Resonance: c.signals?.resonance?.toFixed(1),
      Relevance: c.signals?.relevance?.toFixed(1),
      Professionalism: c.signals?.professionalism?.toFixed(1),
      "Composite Score": c.composite_score,
      "Profile URL": c.instagram?.profile_url ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Creators");
    const label = INDUSTRIES.find((i) => i.key === industry)?.label ?? "report";
    XLSX.writeFile(wb, `upfluence_${label.toLowerCase()}_${Date.now()}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onOpenSettings={() => setShowSettings(true)} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <IndustryTabs value={industry} onChange={setIndustry} favCount={Object.keys(favs).length} />

        <Toolbar
          search={search}
          onSearch={setSearch}
          reachTier={reachTier}
          onReachTier={setReachTier}
          sortKey={sortKey}
          onSortKey={setSortKey}
          showFilter={showFilter}
          setShowFilter={setShowFilter}
          showSort={showSort}
          setShowSort={setShowSort}
          compareMode={compareMode}
          onToggleCompare={() => {
            setCompareMode((v) => !v);
            if (compareMode) setSelected({});
          }}
          selectedCount={selectedList.length}
          onOpenCompare={() => setShowCompare(true)}
          onExport={exportReport}
        />

        <MethodologyStrip weights={weights} />

        <section className="mt-8">
          {industry !== "favourites" && query.isLoading && <LoadingState />}
          {industry !== "favourites" && query.isError && (
            <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
          )}
          {(industry === "favourites" || query.data) && (
            <>
              {industry !== "favourites" && query.data && (
                <InsightCard insight={query.data.insight} fetchedAt={query.data.fetched_at} />
              )}
              {industry === "favourites" && processed.length === 0 && (
                <EmptyFavs />
              )}
              <CreatorList
                creators={processed}
                favs={favs}
                onToggleFav={toggleFav}
                compareMode={compareMode}
                selected={selected}
                onToggleSelect={toggleSelect}
              />
              {industry !== "favourites" && processed.length === 0 && (
                <p className="mt-6 text-sm text-muted-foreground">
                  No creators match your current filters.
                </p>
              )}
            </>
          )}
        </section>
      </main>

      {showSettings && (
        <SettingsModal
          weights={weights}
          onSave={(w) => { persistWeights(w); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showCompare && (
        <CompareModal creators={selectedList} onClose={() => setShowCompare(false)} />
      )}

      <Footer />
    </div>
  );
}

function Header({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("upfluence:theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("upfluence:theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("upfluence:theme", "dark");
      setIsDark(true);
    }
  };

  return (
    <header className="border-b border-border bg-card/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <img src="/favicon.png" alt="Upfluence logo" className="h-9 w-9 object-contain" />
          <div>
            <h1 className="text-base font-semibold tracking-tight">Upfluence</h1>
            <p className="text-xs text-muted-foreground">Influencer Pulse</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary/40 hover:bg-secondary"
            aria-label="Toggle Dark Mode"
            title="Toggle Dark Mode"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            onClick={onOpenSettings}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary/40 hover:bg-secondary"
            aria-label="Formula Engine Settings"
            title="Formula Engine Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function IndustryTabs({
  value,
  onChange,
  favCount,
}: {
  value: IndustryKey;
  onChange: (v: IndustryKey) => void;
  favCount: number;
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
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary")
            }
          >
            <span aria-hidden>{i.emoji}</span>
            {i.label}
            {i.key === "favourites" && favCount > 0 && (
              <span className={
                "ml-1 rounded-full px-1.5 text-[10px] font-mono " +
                (active ? "bg-primary-foreground/20" : "bg-primary/10 text-primary")
              }>
                {favCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Toolbar({
  search,
  onSearch,
  reachTier,
  onReachTier,
  sortKey,
  onSortKey,
  showFilter,
  setShowFilter,
  showSort,
  setShowSort,
  compareMode,
  onToggleCompare,
  selectedCount,
  onOpenCompare,
  onExport,
}: {
  search: string;
  onSearch: (v: string) => void;
  reachTier: ReachTier;
  onReachTier: (v: ReachTier) => void;
  sortKey: SortKey;
  onSortKey: (v: SortKey) => void;
  showFilter: boolean;
  setShowFilter: (v: boolean) => void;
  showSort: boolean;
  setShowSort: (v: boolean) => void;
  compareMode: boolean;
  onToggleCompare: () => void;
  selectedCount: number;
  onOpenCompare: () => void;
  onExport: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search creators, handles, categories…"
          className="h-10 w-full rounded-full border border-border bg-white pl-9 pr-4 text-sm outline-none transition-colors focus:border-primary"
        />
      </div>

      <div className="relative">
        <button
          onClick={() => { setShowFilter(!showFilter); setShowSort(false); }}
          className={
            "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors " +
            (reachTier !== "all"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-white hover:border-primary/40")
          }
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {reachTier !== "all" && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">1</span>
          )}
        </button>
        {showFilter && (
          <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-border bg-white p-2 shadow-lg">
            <div className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Reach tier
            </div>
            {REACH_TIERS.map((t) => (
              <button
                key={t.key}
                onClick={() => { onReachTier(t.key); setShowFilter(false); }}
                className={
                  "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary " +
                  (reachTier === t.key ? "bg-secondary font-medium text-primary" : "text-foreground")
                }
              >
                <span>{t.label}</span>
                <span className="text-[11px] text-muted-foreground">{t.range}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => { setShowSort(!showSort); setShowFilter(false); }}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-medium transition-colors hover:border-primary/40"
        >
          <ArrowUpDown className="h-4 w-4" />
          Sort
        </button>
        {showSort && (
          <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-border bg-white p-2 shadow-lg">
            <div className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sort by
            </div>
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => { onSortKey(s.key); setShowSort(false); }}
                className={
                  "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary " +
                  (sortKey === s.key ? "bg-secondary font-medium text-primary" : "text-foreground")
                }
              >
                <span>{s.label}</span>
                {sortKey === s.key && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onToggleCompare}
        className={
          "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors " +
          (compareMode
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-white hover:border-primary/40")
        }
      >
        <GitCompare className="h-4 w-4" />
        {compareMode ? `Comparing (${selectedCount})` : "Compare"}
      </button>
      {compareMode && selectedCount >= 2 && (
        <button
          onClick={onOpenCompare}
          className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          View comparison
        </button>
      )}

      <button
        onClick={onExport}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-medium transition-colors hover:border-primary/40"
      >
        <Download className="h-4 w-4" />
        Export Report
      </button>
    </div>
  );
}

function MethodologyStrip({ weights }: { weights: Weights }) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Ranking methodology</h2>
        <span className="text-xs text-muted-foreground">
          Composite score, 0–100 · adjust weights in settings
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {SIGNAL_META.map((s) => {
          const pct = Math.round((weights[s.key] / sum) * 100);
          return (
            <div key={s.key} className="rounded-xl border border-border bg-secondary/50 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-primary">{s.label}</span>
                <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.desc}</p>
            </div>
          );
        })}
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

function EmptyFavs() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
      <Heart className="mx-auto h-6 w-6 text-primary" />
      <h3 className="mt-2 text-sm font-semibold">No favourites yet</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Tap the heart on any creator to save them here for quick access.
      </p>
    </div>
  );
}

function CreatorList({
  creators,
  favs,
  onToggleFav,
  compareMode,
  selected,
  onToggleSelect,
}: {
  creators: any[];
  favs: Record<number, any>;
  onToggleFav: (c: any) => void;
  compareMode: boolean;
  selected: Record<number, any>;
  onToggleSelect: (c: any) => void;
}) {
  return (
    <div className="space-y-3">
      {creators.map((c) => (
        <CreatorRow
          key={c.influencer_id}
          creator={c}
          isFav={!!favs[c.influencer_id]}
          onToggleFav={() => onToggleFav(c)}
          compareMode={compareMode}
          isSelected={!!selected[c.influencer_id]}
          onToggleSelect={() => onToggleSelect(c)}
        />
      ))}
    </div>
  );
}

function CreatorRow({
  creator,
  isFav,
  onToggleFav,
  compareMode,
  isSelected,
  onToggleSelect,
}: {
  creator: any;
  isFav: boolean;
  onToggleFav: () => void;
  compareMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const ig = creator.instagram;
  return (
    <article
      className={
        "group grid grid-cols-[auto_1fr] gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md sm:grid-cols-[auto_1fr_auto] " +
        (compareMode && isSelected ? "border-primary ring-2 ring-primary/30" : "border-border")
      }
    >
      <div className="flex items-center gap-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
          {creator.rank}
        </div>
        <div className="relative">
          {creator.avatar_url ? (
            <img
              src={creator.avatar_url}
              alt={creator.name}
              className="h-14 w-14 rounded-full border border-border object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-secondary" />
          )}
          {ig?.verified && (
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground shadow">✓</span>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold tracking-tight">{creator.name}</h3>
          <button
            onClick={onToggleFav}
            aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
          >
            <Heart className={"h-4 w-4 " + (isFav ? "fill-primary text-primary" : "")} />
          </button>
          {ig && (
            <a href={ig.profile_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">
              @{ig.username} ↗
            </a>
          )}
          {creator.country && (
            <span className="text-[11px] uppercase text-muted-foreground">{creator.country}</span>
          )}
        </div>
        {creator.bio && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{creator.bio}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(creator.categories || []).map((cat: string) => (
            <span key={cat} className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
              {cat}
            </span>
          ))}
        </div>
        {ig && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Followers" value={formatCount(ig.followers)} />
            <Metric label="Engagement" value={`${ig.engagement_rate.toFixed(2)}%`} />
            <Metric label="Avg. likes" value={formatCount(Math.round(ig.average_likes))} />
            <Metric label="Avg. views" value={formatCount(Math.round(ig.average_views))} />
          </div>
        )}
      </div>

      <div className="col-span-2 flex items-center justify-between border-t border-border pt-4 sm:col-span-1 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Composite</div>
          <div className="font-mono text-3xl font-bold text-primary">{creator.composite_score.toFixed(1)}</div>
        </div>
        <SignalBars signals={creator.signals} />
        {compareMode && (
          <button
            onClick={onToggleSelect}
            className={
              "mt-3 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
              (isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-foreground hover:border-primary/40")
            }
          >
            {isSelected ? <Check className="h-3 w-3" /> : null}
            {isSelected ? "Selected" : "Select"}
          </button>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-foreground">{value}</div>
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
        const v = signals?.[k] ?? 0;
        return (
          <div key={k} className="flex flex-col items-center gap-0.5" title={`${k}: ${v.toFixed(0)}`}>
            <div className="relative h-10 w-2 overflow-hidden rounded-full bg-secondary">
              <div className="absolute bottom-0 left-0 right-0 bg-primary" style={{ height: `${Math.max(2, Math.min(100, v))}%` }} />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground">{letter}</span>
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
        <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-secondary/50" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <h3 className="text-sm font-semibold text-destructive">Couldn't load data</h3>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      <button onClick={onRetry} className="mt-3 rounded-md border border-destructive/40 bg-white px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10">
        Try again
      </button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
        Built with the Upfluence Public API. Rankings are computed on-the-fly from live creator signals and cached briefly to respect API rate limits.
      </div>
    </footer>
  );
}

// -- Modals --

function ModalShell({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={"w-full rounded-2xl border border-border bg-white shadow-xl " + (wide ? "max-w-5xl" : "max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border p-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-secondary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function SettingsModal({ weights, onSave, onClose }: { weights: Weights; onSave: (w: Weights) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Weights>(weights);
  const sum = Object.values(draft).reduce((a, b) => a + b, 0);
  const isValid = sum === 100;

  return (
    <ModalShell title="Formula Engine Settings" subtitle="Set your percentage for each vector. Total must equal exactly 100%." onClose={onClose}>
      <div className="space-y-4">
        {SIGNAL_META.map((s) => {
          const v = draft[s.key];
          return (
            <div key={s.key}>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold text-primary">{v}%</div>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={v}
                onChange={(e) => setDraft({ ...draft, [s.key]: Number(e.target.value) })}
                className="mt-2 w-full accent-[hsl(var(--primary))]"
              />
            </div>
          );
        })}
      </div>

      {/* Live total visual layout row */}
      <div className="mt-4 rounded-xl border border-dashed p-3 bg-secondary/30 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Current total sum:</span>
        <span className={`font-mono text-sm font-bold ${isValid ? "text-green-600" : "text-destructive"}`}>
          {sum}% / 100% {isValid ? "✓ Ready" : `(Needs ${100 - sum > 0 ? "plus " : ""}${100 - sum}%)`}
        </span>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <button onClick={() => setDraft(DEFAULT_WEIGHTS)} className="text-xs font-medium text-muted-foreground hover:text-primary">
          Reset to defaults
        </button>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-white px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
          <button 
            onClick={() => onSave(draft)} 
            disabled={!isValid}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              isValid 
                ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer" 
                : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
            }`}
          >
            Save weights
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function CompareModal({ creators, onClose }: { creators: any[]; onClose: () => void }) {
  const metrics: { label: string; get: (c: any) => string | number }[] = [
    { label: "Composite score", get: (c) => c.composite_score.toFixed(1) },
    { label: "Followers", get: (c) => formatCount(c.instagram?.followers ?? 0) },
    { label: "Engagement rate", get: (c) => `${(c.instagram?.engagement_rate ?? 0).toFixed(2)}%` },
    { label: "Avg. likes", get: (c) => formatCount(Math.round(c.instagram?.average_likes ?? 0)) },
    { label: "Avg. views", get: (c) => formatCount(Math.round(c.instagram?.average_views ?? 0)) },
    { label: "Verified", get: (c) => (c.instagram?.verified ? "Yes" : "No") },
    { label: "Country", get: (c) => c.country ?? "—" },
    { label: "Reach signal", get: (c) => (c.signals?.reach ?? 0).toFixed(0) },
    { label: "Engagement signal", get: (c) => (c.signals?.engagement ?? 0).toFixed(0) },
    { label: "Resonance signal", get: (c) => (c.signals?.resonance ?? 0).toFixed(0) },
    { label: "Relevance signal", get: (c) => (c.signals?.relevance ?? 0).toFixed(0) },
    { label: "Professionalism signal", get: (c) => (c.signals?.professionalism ?? 0).toFixed(0) },
  ];
  return (
    <ModalShell title="Creator comparison" subtitle={`Side-by-side view of ${creators.length} creators`} onClose={onClose} wide>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-40 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Metric</th>
              {creators.map((c) => (
                <th key={c.influencer_id} className="px-3 py-3 text-left">
                  <div className="flex items-center gap-2">
                    {c.avatar_url && (
                      <img src={c.avatar_url} alt="" className="h-8 w-8 rounded-full border border-border object-cover" referrerPolicy="no-referrer" />
                    )}
                    <div>
                      <div className="text-sm font-semibold">{c.name}</div>
                      {c.instagram && <div className="text-[11px] font-mono text-muted-foreground">@{c.instagram.username}</div>}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label} className="border-b border-border/60">
                <td className="py-2 pr-3 text-xs text-muted-foreground">{m.label}</td>
                {creators.map((c) => (
                  <td key={c.influencer_id} className="px-3 py-2 font-mono text-sm text-foreground">{m.get(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}
