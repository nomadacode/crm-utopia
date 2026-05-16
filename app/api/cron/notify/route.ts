import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth !== `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (unauthorized(req)) return new NextResponse("forbidden", { status: 403 });

  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  type LeadRow = {
    score: "hot" | "warm" | "cold";
    reason: string;
    qualified_at: string;
    contact: { phone: string; name: string | null } | null;
  };

  const { data } = await supabase
    .from("leads")
    .select("score, reason, qualified_at, contact:contacts(phone, name)")
    .gte("qualified_at", since)
    .order("qualified_at", { ascending: false });

  const all = (data ?? []) as unknown as LeadRow[];
  if (all.length === 0) return NextResponse.json({ ok: true, sent: false });

  const hot = all.filter((l) => l.score === "hot");
  const warm = all.filter((l) => l.score === "warm");
  const cold = all.filter((l) => l.score === "cold");

  const row = (l: LeadRow) =>
    `<li><strong>${l.contact?.name ?? "(sin nombre)"}</strong> — ${l.contact?.phone ?? ""}<br/><em>${l.reason}</em></li>`;

  const html = `
    <h2>Digest UtopIA — últimas 24h</h2>
    <p><strong>Total leads:</strong> ${all.length} · 🔥 ${hot.length} hot · 🌤️ ${warm.length} warm · ❄️ ${cold.length} cold</p>
    ${hot.length ? `<h3>🔥 Hot</h3><ul>${hot.map(row).join("")}</ul>` : ""}
    ${warm.length ? `<h3>🌤️ Warm</h3><ul>${warm.map(row).join("")}</ul>` : ""}
  `;

  await sendNotification(`UtopIA — ${all.length} leads en las últimas 24h`, html);
  return NextResponse.json({ ok: true, sent: true, count: all.length });
}
