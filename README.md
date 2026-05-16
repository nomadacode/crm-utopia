# CRM UtopIA

WhatsApp CRM con agente IA integrado. UtopIA responde mensajes automáticamente, califica leads (hot/warm/cold) y hace follow-up. Panel web con dashboard, conversaciones, editor de prompt y modo test.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind 4
- **shadcn/ui** + lucide-react + Geist font
- **Supabase** (Postgres + Auth magic link)
- **WhatsApp Cloud API** (Meta)
- **OpenRouter** → `deepseek/deepseek-chat-v3-0324`
- **Resend** (emails: alertas de leads hot + digest diario)
- **Vercel** (deploy + crons)

## Setup local

```bash
npm install
cp .env.example .env.local
# completar todas las variables en .env.local
npm run dev
```

## Variables de entorno

Ver `.env.example` — están todas documentadas con dónde obtener cada una.

## Estructura

```
app/
  api/
    webhook/        Webhook de Meta (mensajes entrantes + statuses)
    cron/notify     Digest diario de leads (21:00 UTC)
    cron/followup   Follow-ups automáticos (13/17/21 UTC)
  dashboard/        Métricas
  conversations/    Listado + detalle de conversaciones
  settings/         Editor del system prompt de UtopIA
  test-chat/        Probar el agente sin gastar WhatsApp
lib/
  supabase/         Clientes (server + client)
  whatsapp.ts       Wrapper Graph API
  ai.ts             OpenRouter + clasificación de leads
  resend.ts         Envío de emails
  utopia-prompt.ts  System prompt y reglas
components/
  ui/               shadcn primitives
```

## Look & feel

Light mode minimalista. Fondo crema (`oklch(0.97 0.008 95)`), verde lima de acento (`oklch(0.9 0.21 125)`), negro para CTAs, cards muy redondeadas (~24px). Inspirado en HubSpot moderno + Linear.
