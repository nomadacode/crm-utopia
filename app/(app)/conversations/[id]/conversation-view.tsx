"use client";

import { useEffect, useState } from "react";
import type { Channel, Message } from "@/lib/types";
import {
  useRealtimeInserts,
  useRealtimeUpdates,
} from "@/lib/supabase/realtime";
import { ChannelIcon } from "@/components/channel-icon";
import { SendMessageForm } from "./send-form";

type ContactSummary = {
  id: string;
  phone: string;
  name: string | null;
  typing_until: string | null;
  channel: Channel;
};

export function ConversationView({
  initialContact,
  initialMessages,
}: {
  initialContact: ContactSummary;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [contact, setContact] = useState<ContactSummary>(initialContact);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);

  // Realtime: append new messages as they arrive
  useRealtimeInserts<Message>(
    "messages",
    `contact_id=eq.${contact.id}`,
    (payload) => {
      const newMsg = payload.new;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      // Drop matching pending message (the optimistic one is now in DB)
      setPendingMessages((prev) =>
        prev.filter((p) => p.content !== newMsg.content),
      );
    },
  );

  // Realtime: subscribe to message UPDATE events for status changes (sent → delivered → read)
  useRealtimeUpdates<Message>(
    "messages",
    `contact_id=eq.${contact.id}`,
    (payload) => {
      const updated = payload.new;
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m)),
      );
    },
  );

  // Realtime: track typing indicator (and any other contact UPDATEs).
  // Merge instead of replace — partial updates would otherwise wipe other fields.
  useRealtimeUpdates<ContactSummary>(
    "contacts",
    `id=eq.${contact.id}`,
    (payload) => {
      setContact((prev) => ({ ...prev, ...payload.new }));
    },
  );

  const isTyping =
    contact.typing_until && new Date(contact.typing_until).getTime() > Date.now();

  function addPendingMessage(content: string) {
    setPendingMessages((prev) => [
      ...prev,
      { id: `pending-${Date.now()}`, content, createdAt: new Date().toISOString() },
    ]);
  }

  function markPendingFailed(content: string) {
    setPendingMessages((prev) =>
      prev.map((p) => (p.content === content ? { ...p, failed: true } : p)),
    );
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {(contact.name ?? contact.phone).slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <ChannelIcon channel={contact.channel} size={11} />
            <span className="truncate text-sm font-medium">
              {contact.name ?? contact.phone}
            </span>
          </div>
          <div className="truncate text-xs text-muted-foreground tabular">
            {contact.phone}
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-5 py-6">
        {messages.length === 0 && pendingMessages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Sin mensajes todavía.
          </p>
        )}
        {messages.map((m) => (
          <Bubble
            key={m.id}
            role={m.role}
            content={m.content}
            createdAt={m.created_at}
            status={m.status}
            mediaType={m.media_type}
            mediaUrl={m.media_url}
            sentiment={m.sentiment}
          />
        ))}
        {pendingMessages.map((p) => (
          <Bubble
            key={p.id}
            role="assistant"
            content={p.content}
            createdAt={p.createdAt}
            pending={!p.failed}
            failed={p.failed}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <ScrollToBottom deps={[messages.length, pendingMessages.length, isTyping]} />
      </div>

      <div className="border-t border-border px-5 py-3">
        <SendMessageForm
          contactId={contact.id}
          onSend={addPendingMessage}
          onFailed={markPendingFailed}
        />
      </div>
    </>
  );
}

type PendingMessage = {
  id: string;
  content: string;
  createdAt: string;
  failed?: boolean;
};

function Bubble({
  role,
  content,
  createdAt,
  status,
  pending,
  failed,
  mediaType,
  mediaUrl,
  sentiment,
}: {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status?: string | null;
  pending?: boolean;
  failed?: boolean;
  mediaType?: string | null;
  mediaUrl?: string | null;
  sentiment?: string | null;
}) {
  const mine = role === "assistant";
  const sentimentDot =
    !mine && sentiment
      ? sentiment === "positive"
        ? "bg-lime-500"
        : sentiment === "negative"
          ? "bg-rose-500"
          : "bg-zinc-300"
      : null;
  return (
    <div className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
      {sentimentDot && (
        <span
          className={`mb-2 h-1.5 w-1.5 shrink-0 rounded-full ${sentimentDot}`}
          aria-label={`Sentimiento ${sentiment}`}
          title={`Sentimiento: ${sentiment}`}
        />
      )}
      <div
        className={`max-w-[70%] rounded-md px-3.5 py-2 ${
          mine
            ? failed
              ? "bg-destructive/10 text-destructive"
              : "bg-foreground text-background"
            : "bg-muted text-foreground"
        } ${pending ? "opacity-60" : ""}`}
      >
        {mediaType === "image" && mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt="adjunto"
            className="mb-1.5 max-h-64 rounded-sm object-cover"
          />
        )}
        {mediaType === "audio" && mediaUrl && (
          <audio
            controls
            src={mediaUrl}
            className="mb-1.5 max-w-full"
            preload="none"
          />
        )}
        <div className="whitespace-pre-wrap text-sm leading-snug">{content}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] tabular opacity-60">
          {new Date(createdAt).toLocaleString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
          })}
          {status && mine && !pending && (
            <span className="lowercase">· {status}</span>
          )}
          {failed && <span>· error al enviar</span>}
          {pending && <span>· enviando</span>}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-end">
      <div className="flex items-center gap-1.5 rounded-md bg-muted px-3.5 py-2 text-sm text-muted-foreground">
        <span className="flex gap-0.5">
          <Dot delay={0} />
          <Dot delay={150} />
          <Dot delay={300} />
        </span>
        <span className="text-xs">UtopIA está escribiendo</span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1 w-1 rounded-full bg-current animate-pulse"
      style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
    />
  );
}

function ScrollToBottom({ deps }: { deps: unknown[] }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = document.scrollingElement;
    requestAnimationFrame(() => {
      const el = document.querySelector("[data-chat-scroll-anchor]");
      el?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <div data-chat-scroll-anchor />;
}
