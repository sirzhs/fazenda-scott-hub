import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const eventSchema = z.object({
  module: z.string().min(1).max(60),
  action: z.string().min(1).max(60),
  summary: z.string().min(1).max(1500),
  fields: z
    .array(z.object({ name: z.string().max(60), value: z.string().max(200) }))
    .max(10)
    .optional(),
});

const COLORS: Record<string, number> = {
  criado: 0x3f7d4f,
  atualizado: 0xb0893c,
  removido: 0xa33a2b,
  importado: 0x2f6d8a,
};

function isDiscordWebhook(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      /(^|\.)discord(app)?\.com$/.test(parsed.hostname) &&
      parsed.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

async function postToDiscord(
  url: string,
  payload: { module: string; action: string; summary: string; fields?: { name: string; value: string }[] },
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "Fazenda Scott",
      embeds: [
        {
          title: `${payload.module} · ${payload.action}`,
          description: payload.summary,
          color: COLORS[payload.action.toLowerCase()] ?? 0x264230,
          fields: payload.fields?.map((f) => ({ name: f.name, value: f.value, inline: true })),
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Discord respondeu ${response.status}`);
  }
}

/** Envia um evento do app para o webhook configurado pelo usuário. */
export const sendDiscordEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eventSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: settings } = await context.supabase
      .from("app_settings")
      .select("discord_webhook_url, notify_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();

    const url = settings?.discord_webhook_url ?? "";
    if (!settings?.notify_enabled || !url || !isDiscordWebhook(url)) {
      return { sent: false as const };
    }

    await postToDiscord(url, data);
    return { sent: true as const };
  });

/** Testa uma URL de webhook antes de salvar. */
export const testDiscordWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().url() }).parse(input))
  .handler(async ({ data }) => {
    if (!isDiscordWebhook(data.url)) {
      throw new Error("Use uma URL de webhook do Discord (https://discord.com/api/webhooks/...).");
    }
    await postToDiscord(data.url, {
      module: "Configurações",
      action: "atualizado",
      summary: "Teste de conexão: o Fazenda Scott está ligado a este canal. ✅",
    });
    return { ok: true as const };
  });
