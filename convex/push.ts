import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Delivers push notifications to all registered device tokens for a given user.
 * Supports both Expo push tokens (`ExponentPushToken[...]`) and direct FCM tokens.
 */
export const sendPushNotification = action({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const tokens = await ctx.runQuery(internal.notifications.getUserDeviceTokensInternal, { userId: args.userId });
    if (!tokens || tokens.length === 0) return { delivered: 0 };

    let delivered = 0;
    const expoTokens: string[] = [];
    const fcmTokens: string[] = [];

    for (const device of tokens) {
      if (device.fcmToken.startsWith("ExponentPushToken[") || device.fcmToken.startsWith("ExpoPushToken[")) {
        expoTokens.push(device.fcmToken);
      } else {
        fcmTokens.push(device.fcmToken);
      }
    }

    // 1. Deliver to Expo push tokens via Expo Push API
    if (expoTokens.length > 0) {
      try {
        const messages = expoTokens.map((token) => ({
          to: token,
          sound: "default",
          title: args.title,
          body: args.body,
          data: args.data ?? {},
        }));

        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
        });

        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            for (let i = 0; i < json.data.length; i++) {
              const ticket = json.data[i];
              if (ticket.status === "ok") {
                delivered++;
              } else if (ticket.details?.error === "DeviceNotRegistered") {
                await ctx.runMutation(internal.notifications.removeInvalidDeviceTokenInternal, {
                  fcmToken: expoTokens[i],
                });
              }
            }
          } else {
            delivered += expoTokens.length;
          }
        }
      } catch {
        // Safe degrade on network failure
      }
    }

    // 2. Deliver to raw FCM tokens if FCM_SERVER_KEY is configured
    const fcmServerKey = process.env.FCM_SERVER_KEY;
    if (fcmTokens.length > 0 && fcmServerKey) {
      for (const token of fcmTokens) {
        try {
          const res = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Authorization": `key=${fcmServerKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: token,
              notification: {
                title: args.title,
                body: args.body,
              },
              data: args.data ?? {},
            }),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.failure > 0 && json.results?.[0]?.error === "NotRegistered") {
              await ctx.runMutation(internal.notifications.removeInvalidDeviceTokenInternal, {
                fcmToken: token,
              });
            } else {
              delivered++;
            }
          }
        } catch {
          // Safe degrade
        }
      }
    }

    return { delivered };
  },
});
