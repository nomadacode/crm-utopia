export type Channel = "whatsapp" | "telegram";

export type EscalationReason =
  | "explicit_request"
  | "frustration"
  | "manual"
  | "bot_initiated";

export type Contact = {
  id: string;
  phone: string;
  name: string | null;
  created_at: string;
  ad_source: string | null;
  ctwa_clid: string | null;
  blocked: boolean;
  bot_enabled: boolean;
  typing_until: string | null;
  last_read_at: string | null;
  archived_at: string | null;
  stage_id: string | null;
  deal_value: number | null;
  industry: string | null;
  needs_human: boolean;
  escalated_at: string | null;
  escalation_reason: EscalationReason | null;
  channel: Channel;
  email: string | null;
  company: string | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  timeline: string | null;
  pain_points: string | null;
  main_goal: string | null;
  profile_updated_at: string | null;
  profile_enriching_until: string | null;
};

export type PipelineStage = {
  id: string;
  name: string;
  position: number;
  color: string;
  created_at: string;
};

export type ContactNote = {
  id: string;
  contact_id: string;
  content: string;
  created_at: string;
};

export type Reminder = {
  id: string;
  contact_id: string;
  message: string;
  remind_at: string;
  dismissed_at: string | null;
  created_at: string;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

export const TAG_COLORS = [
  "gray",
  "lime",
  "blue",
  "amber",
  "violet",
  "pink",
  "red",
  "cyan",
] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export type Message = {
  id: string;
  contact_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  whatsapp_message_id: string | null;
  status: "sent" | "delivered" | "read" | "failed" | null;
  media_type: "audio" | "image" | "video" | "document" | null;
  media_url: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  flagged_reason: string | null;
  channel: Channel | null;
};

export type LeadScore = "hot" | "warm" | "cold";

export type Lead = {
  id: string;
  contact_id: string;
  score: LeadScore;
  reason: string;
  qualified_at: string;
  notified: boolean;
};
