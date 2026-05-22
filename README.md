# 🤖 CRM UtopIA — WhatsApp y Telegram CRM con agente de IA integrado

Un CRM full-stack construido sobre Next.js que conecta WhatsApp (y Telegram) con un agente de inteligencia artificial que responde clientes automáticamente, califica leads y hace follow-up. El equipo humano solo interviene cuando realmente importa.

---

## ¿Qué problema resuelve?

Responder WhatsApp a mano es lento, inconsistente y no escala. UtopIA es el agente que atiende clientes 24/7, detecta si hay intención real de compra y alerta al equipo humano en el momento justo — sin que nadie tenga que estar pegado al teléfono.

---

## ¿Qué hace exactamente?

### El agente UtopIA (IA)
- Responde mensajes de WhatsApp y Telegram de forma automática, en español argentino con voseo
- Clasifica cada conversación como **Hot / Warm / Cold** en función del interés real del cliente
- Detecta señales de frustración o pedidos de atención humana y **escala al equipo** automáticamente con notificación por email
- Extrae datos del lead en background mientras charla: email, empresa, web, Instagram, LinkedIn, problema a resolver, objetivo
- Transcribe audios con Whisper (OpenAI) y describe imágenes con GPT-4o-mini antes de pasarlos al contexto
- Hace **follow-up automático** a contactos que no respondieron (entre 5 y 23 horas después del último mensaje)
- Protege contra prompt injection y mensajes maliciosos con un stack de seguridad propio

### El panel web (CRM)
- **Dashboard** con métricas de los últimos 7 días: contactos, mensajes, leads hot/warm/cold, tiempos de respuesta del bot vs. humanos
- **Bandeja de conversaciones** con filtros por estado (leídas, hot, warm, cold, archivadas, necesita humano), búsqueda full-text y acciones en masa
- **Vista de conversación** en tiempo real con indicador de typing, burbujas de mensajes con estado (enviado/entregado/leído), soporte para audio e imágenes, y posibilidad de escribir mensajes manuales
- **Panel de lead** por contacto: perfil enriquecido automáticamente por UtopIA con badge animado mientras procesa, score de calificación, etapa del pipeline, valor estimado del deal, tags, recordatorios y notas privadas
- **Pipeline Kanban** drag-and-drop para mover contactos entre etapas con actualización optimista
- **Página de Leads** con tabla filtrable por score y etapa
- **Test Chat** para probar a UtopIA sin consumir WhatsApp real — modo sandbox con streaming de respuestas
- **Ajustes** con editor de personalidad del bot (presets), contexto del negocio (nombre, servicios, precios, horarios, link de calendario), reglas de derivación y gestión de usuarios con roles

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| **Framework** | Next.js 16 (App Router, Server Components, `after()` para background jobs) |
| **Lenguaje** | TypeScript strict |
| **Estilos** | Tailwind CSS v4 + shadcn/ui (Base UI) |
| **Base de datos** | Supabase (Postgres) con RLS |
| **Realtime** | Supabase Realtime — subscripciones a INSERT/UPDATE/DELETE por tabla |
| **Auth** | Supabase Auth con magic link (sin contraseña) |
| **IA** | OpenRouter → DeepSeek Chat v3 (texto) + GPT-4o-mini (visión) |
| **Transcripción de audio** | OpenAI Whisper |
| **WhatsApp** | Meta Cloud API (webhooks + envío) |
| **Telegram** | Telegram Bot API (webhooks + envío) |
| **Emails** | Resend (alertas de leads hot, digest diario, recordatorios) |
| **Storage** | Supabase Storage (audios e imágenes de WhatsApp/Telegram) |
| **Deploy** | Vercel (funciones serverless + crons programados) |
| **Drag & drop** | @dnd-kit/core |
| **Iconos** | lucide-react |
| **Notificaciones** | sonner |

---

## Arquitectura en tres palabras

**Webhook → Procesador → Panel**

Cada mensaje entrante (WhatsApp o Telegram) dispara un webhook que pasa por un procesador centralizado (`lib/conversation-processor.ts`). Ese procesador se encarga de: idempotencia, seguridad, rate limiting, detección de handoff, generación de respuesta con la IA, envío, y tareas en background (clasificación de lead, análisis de sentimiento, enriquecimiento de perfil). El panel consume Supabase en tiempo real y se actualiza sin recargar.

### Flujo de un mensaje entrante

```
Cliente manda mensaje
        ↓
   Webhook (WA o TG)
        ↓
   processInboundMessage()
   ├── Upsert contacto
   ├── Idempotencia (evitar duplicados)
   ├── Seguridad (inyección, rate limit, budget)
   ├── Clasificación de handoff (¿pide humano? ¿frustración?)
   ├── Generar respuesta con IA
   ├── Enviar mensaje de vuelta
   └── after(): clasificar lead + sentimiento + enriquecer perfil
        ↓
   Panel se actualiza en tiempo real (Supabase Realtime)
```

---

## Estructura del proyecto

```
app/
├── (app)/
│   ├── conversations/        # Bandeja + vista de conversación individual
│   │   └── [id]/             # Componentes del chat: mensajes, controles, lead, tags, notas
│   ├── dashboard/            # Métricas y actividad reciente
│   ├── leads/                # Tabla de leads calificados con filtros
│   ├── pipeline/             # Kanban drag-and-drop
│   ├── settings/             # Presets, perfil de negocio, tags, usuarios
│   └── test-chat/            # Sandbox para probar UtopIA
├── api/
│   ├── webhook/              # Webhook de Meta (WhatsApp)
│   ├── telegram/webhook/     # Webhook de Telegram
│   ├── contacts/[id]/        # PATCH, send, tags, notas, recordatorios, escalate
│   ├── conversations/bulk/   # Acciones en masa
│   ├── cron/
│   │   ├── followup/         # Follow-ups automáticos
│   │   ├── notify/           # Digest diario de leads
│   │   └── reminders/        # Envío de recordatorios
│   ├── presets/              # CRUD de presets del system prompt
│   ├── tags/                 # CRUD de tags
│   ├── users/                # Invite, patch, list
│   └── test-chat/            # Proxy de streaming para el sandbox
lib/
├── ai.ts                     # OpenRouter: generateReply, classifyLead, classifySentiment, extractLeadProfile, classifyHandoffNeed, describeImage
├── conversation-processor.ts # Pipeline central de procesamiento de mensajes
├── handoff.ts                # Lógica de escalado a humano
├── security.ts               # Anti-injection, rate limit, budget, sanitización
├── utopia-prompt.ts          # System prompt, presets, variables, perfil de negocio
├── whatsapp.ts               # Wrapper Graph API (enviar, leer, descargar media)
├── media.ts                  # Upload a Supabase Storage + transcripción Whisper
├── resend.ts                 # Envío de emails
├── audit.ts                  # Log de acciones administrativas
├── auth.ts                   # getCurrentUser, requireUser, requireAdmin
├── channels/
│   ├── dispatch.ts           # Abstracción multicanal (WA + TG)
│   └── telegram.ts           # Wrapper Bot API
└── supabase/
    ├── admin.ts              # Cliente service role
    ├── client.ts             # Cliente browser
    ├── server.ts             # Cliente server con cookies
    └── realtime.ts           # Hooks de React para INSERT/UPDATE/DELETE en tiempo real
components/
├── sidebar.tsx               # Sidebar colapsable con estado en localStorage
└── ui/                       # Primitivos de shadcn (Button, Card, Input, etc.)
```

---

## Setup local

### Requisitos

- Node.js ≥ 20
- Una cuenta en Supabase (free tier alcanza para desarrollo)
- Una cuenta en OpenRouter (para el modelo de IA)
- Opcional: cuenta de Meta Business + WhatsApp Cloud API, bot de Telegram

### Pasos

```bash
git clone <repo>
cd crm-utopia
npm install
cp .env.example .env.local
# completar las variables en .env.local (ver sección abajo)
npm run dev
```

La app queda en `http://localhost:3000`. Para probar la IA sin conectar WhatsApp, usá `/test-chat`.

### Variables de entorno

Ver `.env.example` — cada variable está documentada con dónde obtenerla. Las mínimas para que la app funcione localmente son:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
ALLOWED_EMAILS=          # tu email para poder loguearte
CRON_SECRET=             # cualquier string random
```

El resto (WhatsApp, Telegram, Resend, OpenAI para Whisper) son opcionales para desarrollo local.

---

## Configurar WhatsApp

1. Crear una app en [Meta for Developers](https://developers.facebook.com)
2. Agregar el producto **WhatsApp**
3. Copiar `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_ACCESS_TOKEN`
4. Inventar un `WHATSAPP_VERIFY_TOKEN` (string random)
5. Configurar el webhook de Meta apuntando a `https://tu-dominio/api/webhook`
6. En desarrollo con números argentinos puede ser necesario `WHATSAPP_RECIPIENT_OVERRIDES` (ver `.env.example`)

## Configurar Telegram

Ver `docs/telegram-setup.md` — guía paso a paso en ~5 minutos.

---

## Deploy en Vercel

```bash
vercel deploy
```

Los crons están definidos en `vercel.json`:

| Cron | Horario (UTC) | Qué hace |
|---|---|---|
| `/api/cron/notify` | 21:00 diario | Digest de leads de las últimas 24hs |
| `/api/cron/followup` | 13:00, 17:00 y 21:00 | Follow-up a contactos sin respuesta |
| `/api/cron/reminders` | 12:00, 15:00, 18:00 y 21:00 | Envío de recordatorios vencidos |

---

## Funcionalidades de seguridad

El proyecto incluye un stack de seguridad propio en `lib/security.ts` que corre en cada mensaje entrante antes de pasarlo a la IA:

- **Anti-prompt injection**: más de 15 patrones en español e inglés (jailbreaks, developer mode, DAN, inyección de roles, bloques de código largo, SQL injection, comandos de shell)
- **Rate limiting por contacto**: máximo 10 mensajes/minuto y 30 mensajes/5 minutos
- **Budget diario global**: límite configurable de respuestas del bot por día (default 500) para evitar costos descontrolados
- **Sanitización de respuestas**: strip de markdown, detección de leak del system prompt
- **Notificación de ataques**: si se detecta un intento de inyección, el equipo recibe un email con el contenido del mensaje

---

## Personalización del agente

La personalidad de UtopIA es completamente editable desde `/settings`. Funciona con un sistema de **presets**: distintas configuraciones de system prompt que se pueden activar con un clic. El repo incluye templates listos para usar:

- **Agencia de marketing**
- **Ventas**
- **Soporte técnico**
- **Clínica / Salud**
- **En blanco** (empezar desde cero)

Cada preset soporta **variables dinámicas** que se completan automáticamente en cada conversación:

| Variable | Valor |
|---|---|
| `{{nombre}}` | Nombre del contacto (o "cliente") |
| `{{telefono}}` | Teléfono del contacto |
| `{{ahora}}` | Día y hora actual en Argentina |
| `{{tags}}` | Tags asignados al contacto |
| `{{ultima_interaccion}}` | Tiempo desde el último mensaje del cliente |

---

## Roles de usuario

| Rol | Permisos |
|---|---|
| **Admin** | Todo: ajustes, presets, tags, gestión de usuarios |
| **Agente** | Ver y responder conversaciones, editar perfiles de contactos |

El acceso es por magic link (email sin contraseña). Los admins pueden invitar usuarios, cambiar roles y revocar acceso desde `/settings → Usuarios`.

---

## Diseño y estilo

Light mode minimalista. Fondo crema (`oklch(0.97 0.008 95)`), verde lima de acento (`oklch(0.9 0.21 125)`), negro para CTAs, cards con bordes muy redondeados (~24px). Inspirado en HubSpot moderno + Linear. Las animaciones de carga son CSS puro (pulse, opacity). El sidebar es colapsable y persiste su estado en localStorage.

---

## Sobre el proyecto

Construido como herramienta real para negocios que reciben consultas por WhatsApp y quieren automatizar la primera línea de atención sin perder el trato humano cuando importa. El foco estuvo en que sea **production-ready desde el día uno**: seguridad contra abusos, manejo de errores, idempotencia en webhooks, y una UI que cualquier persona del equipo pueda usar sin entrenamiento.

---

*Next.js 16 · TypeScript · Supabase · OpenRouter · WhatsApp Cloud API · Telegram Bot API · Vercel*
