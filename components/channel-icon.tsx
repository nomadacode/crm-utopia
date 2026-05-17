import { Send, MessageCircle } from "lucide-react";
import type { Channel } from "@/lib/types";

const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

const CHANNEL_CLASSES: Record<Channel, string> = {
  whatsapp: "text-emerald-600",
  telegram: "text-sky-500",
};

export function ChannelIcon({
  channel,
  size = 12,
  className = "",
}: {
  channel: Channel;
  size?: number;
  className?: string;
}) {
  const Icon = channel === "telegram" ? Send : MessageCircle;
  return (
    <Icon
      className={`shrink-0 ${CHANNEL_CLASSES[channel]} ${className}`}
      style={{ width: size, height: size }}
      aria-label={CHANNEL_LABELS[channel]}
    />
  );
}
