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
};

export type Message = {
  id: string;
  contact_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  whatsapp_message_id: string | null;
  status: "sent" | "delivered" | "read" | "failed" | null;
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
