import { Context, Effect, Layer, Ref } from "effect";
import { EventBus } from "../events/services/EventBus";
import type { InternalEventDeclaration } from "../events/types/InternalEventDeclaration";

interface TelegramNotificationServiceInterface {
  readonly start: () => Effect.Effect<void>;
  readonly stop: () => Effect.Effect<void>;
}

const getConfig = () => {
  // biome-ignore lint/style/noProcessEnv: telegram config from env
  const botToken = process.env.CCV_TELEGRAM_BOT_TOKEN;
  // biome-ignore lint/style/noProcessEnv: telegram config from env
  const chatId = process.env.CCV_TELEGRAM_CHAT_ID;
  // biome-ignore lint/style/noProcessEnv: telegram config from env
  const viewerBase = process.env.CCV_TELEGRAM_VIEWER_BASE ?? "";

  if (!botToken || !chatId) {
    return null;
  }

  return { botToken, chatId, viewerBase };
};

const extractRepoName = (cwd: string): string => {
  const parts = cwd
    .replace(/\\/g, "/")
    .replace(/\/$/, "")
    .split("/")
    .filter(Boolean);
  return parts.length >= 3
    ? parts.slice(-3).join("-")
    : parts.join("-") || "unknown";
};

const sendTelegramMessage = async (
  botToken: string,
  chatId: string,
  text: string,
  inlineKeyboard?: { text: string; url: string }[][],
) => {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    };

    if (inlineKeyboard) {
      body.reply_markup = { inline_keyboard: inlineKeyboard };
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Telegram API error:", response.status, errorText);
    }
  } catch (error) {
    console.error("Failed to send Telegram notification:", error);
  }
};

export class TelegramNotificationService extends Context.Tag(
  "TelegramNotificationService",
)<TelegramNotificationService, TelegramNotificationServiceInterface>() {
  static Live = Layer.effect(
    this,
    Effect.gen(function* () {
      const eventBus = yield* EventBus;

      const listenersRef = yield* Ref.make<{
        onSessionProcessChanged?:
          | ((
              event: InternalEventDeclaration["sessionProcessChanged"],
            ) => void)
          | null;
        onPermissionRequested?:
          | ((event: InternalEventDeclaration["permissionRequested"]) => void)
          | null;
      }>({});

      const start = (): Effect.Effect<void> =>
        Effect.gen(function* () {
          const config = getConfig();
          if (!config) {
            console.log(
              "Telegram notifications disabled (CCV_TELEGRAM_BOT_TOKEN or CCV_TELEGRAM_CHAT_ID not set)",
            );
            return;
          }

          console.log("Starting Telegram notification service");

          const onSessionProcessChanged = (
            event: InternalEventDeclaration["sessionProcessChanged"],
          ) => {
            if (event.changed.type !== "paused") {
              return;
            }

            const projectId = event.changed.def.projectId;
            const cwd = event.changed.def.cwd;
            const sessionId = event.changed.sessionId;
            const repoName = extractRepoName(cwd);

            const viewUrl =
              config.viewerBase && sessionId
                ? `${config.viewerBase}/projects/${encodeURIComponent(projectId)}/session?sessionId=${encodeURIComponent(sessionId)}`
                : undefined;

            const text = `✅  <code>[${repoName}]</code> Task completed`;

            sendTelegramMessage(
              config.botToken,
              config.chatId,
              text,
              viewUrl ? [[{ text: "View", url: viewUrl }]] : undefined,
            );
          };

          const onPermissionRequested = (
            event: InternalEventDeclaration["permissionRequested"],
          ) => {
            if (!event.projectId) {
              return;
            }

            const repoName = event.cwd
              ? extractRepoName(event.cwd)
              : "unknown";
            const toolName =
              event.permissionRequest.toolName ?? "unknown tool";

            const viewUrl = config.viewerBase
              ? `${config.viewerBase}/projects/${encodeURIComponent(event.projectId)}/session${event.permissionRequest.sessionId ? `?sessionId=${encodeURIComponent(event.permissionRequest.sessionId)}` : ""}`
              : undefined;

            const text = `🔐  <code>[${repoName}]</code> Permission: ${toolName}`;

            sendTelegramMessage(
              config.botToken,
              config.chatId,
              text,
              viewUrl ? [[{ text: "View", url: viewUrl }]] : undefined,
            );
          };

          yield* Ref.set(listenersRef, {
            onSessionProcessChanged,
            onPermissionRequested,
          });

          yield* eventBus.on(
            "sessionProcessChanged",
            onSessionProcessChanged,
          );
          yield* eventBus.on("permissionRequested", onPermissionRequested);

          console.log("Telegram notification service started");
        });

      const stop = (): Effect.Effect<void> =>
        Effect.gen(function* () {
          const listeners = yield* Ref.get(listenersRef);

          if (listeners.onSessionProcessChanged) {
            yield* eventBus.off(
              "sessionProcessChanged",
              listeners.onSessionProcessChanged,
            );
          }

          if (listeners.onPermissionRequested) {
            yield* eventBus.off(
              "permissionRequested",
              listeners.onPermissionRequested,
            );
          }

          yield* Ref.set(listenersRef, {});
        });

      return { start, stop } satisfies TelegramNotificationServiceInterface;
    }),
  );
}
