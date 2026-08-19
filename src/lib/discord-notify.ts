import { sendDiscordEvent } from "@/lib/discord.functions";

export type NotifyPayload = {
  module: string;
  action: "criado" | "atualizado" | "removido" | "importado";
  summary: string;
  fields?: { name: string; value: string }[];
};

/**
 * Dispara o evento para o webhook do Discord sem bloquear a UI.
 * Falhas são silenciosas de propósito: o registro no app já foi salvo.
 */
export function notifyDiscord(payload: NotifyPayload) {
  void sendDiscordEvent({ data: payload }).catch(() => {
    /* webhook não configurado ou fora do ar — ignorado */
  });
}
