import { createServerFn } from "@tanstack/react-start";
import {
  getIndustryLeaderboard,
  INDUSTRY_META,
  type IndustryKey,
  type RankedCreator,
} from "./upfluence.server";

const INDUSTRY_KEYS = Object.keys(INDUSTRY_META) as IndustryKey[];

export const fetchLeaderboard = createServerFn({ method: "GET" })
  .validator((data: unknown): { industry: IndustryKey } => {
    const industry = (data as { industry?: string })?.industry as IndustryKey;
    if (!INDUSTRY_KEYS.includes(industry)) {
      throw new Error(`Invalid industry: ${industry}`);
    }
    return { industry };
  })
  .handler(async ({ data }): Promise<{
    industry: IndustryKey;
    label: string;
    insight: string;
    creators: RankedCreator[];
    fetched_at: number;
  }> => {
    const result = await getIndustryLeaderboard(data.industry);
    const meta = INDUSTRY_META[data.industry];
    return {
      industry: data.industry,
      label: meta.label,
      insight: meta.insight,
      creators: result.creators,
      fetched_at: result.fetched_at,
    };
  });
