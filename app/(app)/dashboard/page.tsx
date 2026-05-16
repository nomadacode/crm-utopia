import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Flame, Snowflake, Sun, MessageCircle, Users } from "lucide-react";

export const dynamic = "force-dynamic";

async function getStats() {
  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [contactsRes, messagesRes, leadsRes] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("leads")
      .select("score")
      .gte("qualified_at", since),
  ]);

  const leads = leadsRes.data ?? [];
  return {
    totalContacts: contactsRes.count ?? 0,
    messagesWeek: messagesRes.count ?? 0,
    hot: leads.filter((l) => l.score === "hot").length,
    warm: leads.filter((l) => l.score === "warm").length,
    cold: leads.filter((l) => l.score === "cold").length,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de los últimos 7 días.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Contactos"
          value={stats.totalContacts}
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          label="Mensajes 7d"
          value={stats.messagesWeek}
          icon={<MessageCircle className="h-5 w-5" />}
        />
        <MetricCard
          label="Hot"
          value={stats.hot}
          icon={<Flame className="h-5 w-5" />}
          accent
        />
        <MetricCard
          label="Warm"
          value={stats.warm}
          icon={<Sun className="h-5 w-5" />}
        />
        <MetricCard
          label="Cold"
          value={stats.cold}
          icon={<Snowflake className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card
      className={`rounded-3xl p-6 ${accent ? "bg-accent text-accent-foreground" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
    </Card>
  );
}
