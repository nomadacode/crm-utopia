# Setup de Telegram para UtopIA

Guía paso a paso para conectar tu propio bot de Telegram al CRM. **Tiempo total: ~5 minutos.**

## 1) Crear el bot con @BotFather

1. Abrí Telegram (web o app).
2. Buscá el usuario **`@BotFather`** (el oficial, con tick azul).
3. Mandale `/start`.
4. Mandale `/newbot`.
5. Te va a preguntar el **nombre del bot** (lo que ve el usuario). Ej: `UtopIA`.
6. Después el **username** del bot (tiene que terminar en `bot` o `_bot` y ser único globalmente). Ej: `utopia_demo_bot` o `tu_marca_bot`.
7. Te devuelve un **token de acceso** con formato:
   ```
   1234567890:AAGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   **GUARDALO**. Es la "API key" del bot. Cualquiera con este token puede operar el bot.

(Opcional pero recomendado) Mientras estás con @BotFather, configurá:
- `/setdescription` → descripción que se ve en el perfil del bot
- `/setabouttext` → about corto
- `/setuserpic` → avatar
- `/setcommands` → menú de comandos sugeridos (ej: `start - Empezar`, `help - Ayuda`)

## 2) Configurar las variables de entorno

En `.env.local` (local) y en Vercel (producción), agregar:

```
TELEGRAM_BOT_TOKEN=1234567890:AAGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELEGRAM_WEBHOOK_SECRET=algo-secreto-largo-y-random
```

`TELEGRAM_WEBHOOK_SECRET` es opcional pero recomendado: una cadena random que vos inventás. Si la seteás, Telegram va a incluirla como header en cada update y nosotros la validamos.

## 3) Registrar el webhook en Telegram

Una sola llamada para decirle a Telegram dónde mandar los updates. Reemplazá el token y el secret y corré desde la terminal:

```bash
curl -s "https://api.telegram.org/bot<TU_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://crm-utopia.vercel.app/api/telegram/webhook",
    "secret_token": "<TU_TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "edited_message"],
    "drop_pending_updates": true
  }'
```

Te debería responder algo como:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

Para verificar:
```bash
curl -s "https://api.telegram.org/bot<TU_TOKEN>/getWebhookInfo"
```

## 4) Probar

1. Abrí Telegram, buscá tu bot por el username (ej: `@utopia_demo_bot`).
2. Mandale `/start`.
3. Decile algo, ej: "hola, quería preguntarte por tus servicios".
4. UtopIA tiene que responder en segundos.
5. En `/conversations` del CRM vas a ver el contacto con el icono ✈️ azul (Telegram) en vez del verde de WhatsApp.

## 5) (Opcional) Bot público

Por default cualquiera con el username del bot puede escribirle. Si querés que sea **privado** (solo gente invitada), configurá en @BotFather:
```
/setjoingroups → Disable
/setprivacy → Enable
```

Y para evitar que aparezca en búsquedas, NO uses un username "demasiado público" — algo tipo `tu_marca_internal_bot`.

## Troubleshooting

| Problema | Diagnóstico |
|---|---|
| Mando `/start` y no responde | Verificá que `TELEGRAM_BOT_TOKEN` está en Vercel y deployaste después. Probá `getWebhookInfo` y mirá `last_error_message`. |
| getWebhookInfo dice "Wrong response from the webhook" | Tu endpoint está devolviendo algo distinto a 2xx. Revisá los logs en Vercel. |
| getWebhookInfo dice "url contains unauthorized symbols" | Verificá que la URL no tenga espacios ni caracteres raros. |
| Bot responde en otros idiomas o caracteres raros | Mismo prompt + reglas que WhatsApp. Si pasa, ajustá el preset desde `/settings`. |

## Cambiar el webhook después

Si cambiás de dominio o querés desconectar el bot:

```bash
# Cambiar URL
curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://nueva-url/api/telegram/webhook"

# Desconectar completamente
curl -s "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```
