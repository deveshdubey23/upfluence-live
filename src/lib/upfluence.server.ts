// Server-only Upfluence API client. Never import from client code.
// Handles OAuth client_credentials token exchange + in-memory caching.

const TOKEN_URL = "https://identity.upfluence.co/token";
const API_BASE = "https://api.upfluence.co/v1";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.token;
  }
  const clientId = process.env.UPFLUENCE_CLIENT_ID;
  const clientSecret = process.env.UPFLUENCE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Upfluence credentials not configured");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      token_lifetime: 3600,
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return data.access_token;
}

async function upfluenceFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

// --- Types (partial, only the fields we consume) ---
export interface SearchMatch {
  id: number;
  match_score: number;
  influencer_id: number;
}
export interface SearchInfluencer {
  id: number;
  name: string | null;
  first_name: string | null;
  description: string | null;
  avatar_url: string | null;
  country: string | null;
  community_size: number;
  categories: Array<{ id: number; name: string; similarity: number }>;
  has_email: boolean;
  gender: string | null;
  lang: string | null;
}
interface SearchResponse {
  matches: SearchMatch[];
  influencers: SearchInfluencer[];
  meta: { total: number };
}

interface InstagramAccount {
  id: number;
  username: string;
  full_name: string | null;
  bio: string | null;
  followers: number;
  engagement_rate: number; // percent, e.g. 0.5373 means 0.53%
  average_likes: number;
  average_comments: number;
  verified: boolean;
  engagement_growth_rate: number;
  community_growth_rate: number | null;
  media_stats?: {
    video?: { posts: number; average_views?: number; average_engagements?: number };
    image?: { posts: number; average_engagements?: number };
  };
}

interface TikTokAccount {
  id: number;
  username: string;
  followers: number;
  engagement_rate: number; // percent
  average_likes: number;
  average_comments: number;
  average_shares?: number;
  average_plays?: number; // views on TikTok
  verified: boolean;
  engagement_growth_rate?: number;
  community_growth_rate?: number | null;
}

interface YouTubeAccount {
  id: number;
  username: string;
  followers: number; // subscribers
  engagement_rate: number; // percent
  average_views?: number;
  average_likes?: number;
  average_comments?: number;
  verified: boolean;
  engagement_growth_rate?: number;
  community_growth_rate?: number | null;
}

interface ProfileResponse {
  influencer: SearchInfluencer & { 
    instagram_id: number | null; 
    youtube_id: number | null;
    tiktok_id: number | null;
    email?: string; 
  };
  instagrams?: InstagramAccount[];
  tiktoks?: TikTokAccount[];
  youtubes?: YouTubeAccount[];
}

// --- Industry queries (keywords) ---
export type IndustryKey = "beauty" | "fashion" | "fitness" | "food" | "gaming";

export const INDUSTRY_META: Record<
  IndustryKey,
  { label: string; keywords: string; category_hints: string[]; insight: string }
> = {
  beauty: {
    label: "Beauty",
    keywords: "beauty makeup skincare cosmetics",
    category_hints: ["Beauty", "Makeup", "Skincare", "Cosmetics"],
    insight:
      "Beauty creators drive high-intent purchase behavior. Prioritize creators with a healthy blend of tutorial and review content — engagement rate above 1% at 100k+ followers signals a highly loyal audience segment.",
  },
  fashion: {
    label: "Fashion",
    keywords: "fashion style outfit ootd streetwear",
    category_hints: ["Fashion", "Style"],
    insight:
      "Fashion audiences follow for aesthetic and identity. Watch for creators with strong video engagement (Reels/TikTok crossover) — those drive most modern conversion for apparel brands.",
  },
  fitness: {
    label: "Fitness",
    keywords: "fitness workout gym training bodybuilding",
    category_hints: ["Fitness", "Health"],
    insight:
      "Fitness creators command trust for supplements, apparel, and equipment. Look beyond follower counts — average views on video content is a stronger indicator of who's actively watched.",
  },
  food: {
    label: "Food",
    keywords: "food recipe cooking foodie chef",
    category_hints: ["Food", "Cooking", "Recipe"],
    insight:
      "Food creators over-index on saves and shares — signals of intent to try. Prioritize creators whose content includes clear product placement moments (e.g. pantry shots, kitchen tools).",
  },
  gaming: {
    label: "Gaming",
    keywords: "gaming gamer esports streamer twitch",
    category_hints: ["Gaming", "Esports"],
    insight:
      "Gaming audiences are highly niche and platform-native. Cross-platform presence (Twitch + YouTube + TikTok) multiplies campaign reach and reduces single-platform risk.",
  },
};

// --- Ranking output ---
export interface RankedCreator {
  rank: number;
  influencer_id: number;
  name: string;
  avatar_url: string | null;
  country: string | null;
  bio: string | null;
  categories: string[];
  instagram: {
    username: string;
    followers: number;
    engagement_rate: number; // percent
    average_likes: number;
    average_comments: number;
    verified: boolean;
    engagement_growth_rate: number;
    profile_url: string;
  } | null;
  tiktok: {
    username: string;
    followers: number;
    engagement_rate: number; // percent
    average_likes: number;
    average_comments: number;
    average_plays: number; // views
    verified: boolean;
    profile_url: string;
  } | null;
  youtube: {
    username: string;
    followers: number; // subscribers
    engagement_rate: number; // percent
    average_views: number;
    average_likes: number;
    verified: boolean;
    profile_url: string;
  } | null;
  signals: {
    reach: number; // 0-100
    engagement: number;
    resonance: number;
    relevance: number;
    professionalism: number;
  };
  composite_score: number; // 0-100
}

// --- Cache: industry -> {data, expiresAt} ---
const leaderboardCache = new Map<
  IndustryKey,
  { data: RankedCreator[]; expiresAt: number; fetchedAt: number }
>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

async function searchIndustry(industry: IndustryKey): Promise<SearchResponse> {
  const meta = INDUSTRY_META[industry];
  const body = {
    page: 1,
    per_page: 25,
    social_media_matching_operator: "or",
    criteria: [{ type: "should", field: "all", value: meta.keywords }],
    filters: [
      { type: "range-int", field: "instagram.followers", value: { from: 100000 } },
      {
        type: "average-engagement",
        field: "instagram",
        value: 1,
        order: ">",
        isPercent: true,
      },
    ],
    ordering: { field: "instagram.followers", order: "desc", value: "" },
  };
  const res = await upfluenceFetch("/matches", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Search failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as SearchResponse;
}

async function fetchProfile(id: number): Promise<ProfileResponse | null> {
  const res = await upfluenceFetch(`/influencers/${id}`);
  if (!res.ok) return null;
  return (await res.json()) as ProfileResponse;
}

// --- Ranking helpers ---
function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function scoreReach(followers: number): number {
  if (followers <= 0) return 0;
  return clamp(((Math.log10(followers) - 4) / 3) * 100);
}
function scoreEngagement(er: number): number {
  return clamp(((er || 0) / 4) * 100);
}
function scoreResonance(avgViews: number, followers: number): number {
  if (!avgViews || !followers) return 0;
  const ratio = avgViews / followers; // view-through
  return clamp((ratio / 0.5) * 100); // 50% VTR = 100
}
function scoreRelevance(
  categories: SearchInfluencer["categories"],
  hints: string[],
): number {
  if (!categories?.length) return 40;
  const match = categories.find((c) =>
    hints.some((h) => c.name.toLowerCase().includes(h.toLowerCase())),
  );
  if (match) return clamp(50 + match.similarity * 100);
  return clamp((categories[0]?.similarity ?? 0.4) * 100);
}
function scoreProfessionalism(ig: InstagramAccount, hasEmail: boolean): number {
  let s = 40;
  if (ig.verified) s += 30;
  if (hasEmail) s += 15;
  if ((ig.engagement_growth_rate ?? 0) > 0) s += 15;
  return clamp(s);
}

export async function getIndustryLeaderboard(
  industry: IndustryKey,
): Promise<{ industry: IndustryKey; creators: RankedCreator[]; fetched_at: number }> {
  const cached = leaderboardCache.get(industry);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return { industry, creators: cached.data, fetched_at: cached.fetchedAt };
  }

  const search = await searchIndustry(industry);
  const candidates = search.matches.slice(0, 20);
  const influencerMap = new Map(search.influencers.map((i) => [i.id, i]));

  const profiles = await Promise.all(
    candidates.map(async (m) => {
      const base = influencerMap.get(m.influencer_id);
      const profile = await fetchProfile(m.influencer_id);
      return { base, profile };
    }),
  );

  const meta = INDUSTRY_META[industry];
  const scored: RankedCreator[] = [];

  for (const { base, profile } of profiles) {
    if (!base || !profile) continue;
    const ig = profile.instagrams?.[0];
    if (!ig || !ig.followers) continue;

    const tt = profile.tiktoks?.[0] || null;
    const yt = profile.youtubes?.[0] || null;

    let avgViews = 0;
    let resonanceFollowers = ig.followers;

    if (yt && yt.average_views) {
      avgViews = yt.average_views;
      resonanceFollowers = yt.followers;
    }
    if (tt && tt.average_plays && tt.average_plays > avgViews) {
      avgViews = tt.average_plays;
      resonanceFollowers = tt.followers;
    }
    if (avgViews === 0) {
      avgViews = ig.media_stats?.video?.average_views ?? 0;
      resonanceFollowers = ig.followers;
    }

    const signals = {
      reach: scoreReach(ig.followers),
      engagement: scoreEngagement(ig.engagement_rate),
      resonance: scoreResonance(avgViews, resonanceFollowers),
      relevance: scoreRelevance(base.categories, meta.category_hints),
      professionalism: scoreProfessionalism(ig, base.has_email),
    };

    const composite =
      signals.reach * 0.25 +
      signals.engagement * 0.3 +
      signals.resonance * 0.15 +
      signals.relevance * 0.2 +
      signals.professionalism * 0.1;

    scored.push({
      rank: 0,
      influencer_id: base.id,
      name: profile.influencer.name || ig.full_name || ig.username,
      avatar_url: base.avatar_url,
      country: base.country,
      bio: ig.bio || base.description,
      categories: base.categories.map((c) => c.name).slice(0, 3),
      instagram: {
        username: ig.username,
        followers: ig.followers,
        engagement_rate: ig.engagement_rate || 0,
        average_likes: ig.average_likes || 0,
        average_comments: ig.average_comments || 0,
        verified: ig.verified ?? false,
        engagement_growth_rate: ig.engagement_growth_rate ?? 0,
        profile_url: `https://instagram.com/${ig.username}`,
      },
      tiktok: tt ? {
        username: tt.username,
        followers: tt.followers || 0,
        engagement_rate: tt.engagement_rate || 0,
        average_likes: tt.average_likes || 0,
        average_comments: tt.average_comments || 0,
        average_plays: tt.average_plays ?? 0,
        verified: tt.verified ?? false,
        profile_url: `https://tiktok.com/@${tt.username}`,
      } : null,
      youtube: yt ? {
        username: yt.username,
        followers: yt.followers || 0,
        engagement_rate: yt.engagement_rate || 0,
        average_views: yt.average_views ?? 0,
        average_likes: yt.average_likes ?? 0,
        verified: yt.verified ?? false,
        profile_url: `https://youtube.com/@${yt.username}`,
      } : null,
      signals,
      composite_score: Math.round(composite * 10) / 10,
    });
  }

  scored.sort((a, b) => b.composite_score - a.composite_score);
  const top = scored.slice(0, 10).map((c, i) => ({ ...c, rank: i + 1 }));

  leaderboardCache.set(industry, {
    data: top,
    expiresAt: now + CACHE_TTL_MS,
    fetchedAt: now,
  });
  return { industry, creators: top, fetched_at: now };
}
