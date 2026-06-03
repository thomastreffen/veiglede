// Resend Inbound webhook receiver.
//
// SETUP (manual, in Resend dashboard):
//   1. Inbound → Add inbound address: kontakt@veiglede.no
//   2. Set webhook URL to: https://veiglede.no/api/inbound-email
//   3. Copy webhook signing secret and add as INBOUND_WEBHOOK_SECRET
//      in Lovable environment variables (already wired via process.env).
//
// Every incoming email becomes a row in `contact_tickets` with source='epost',
// so it shows up in /admin/henvendelser alongside contact-form submissions.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ResendInboundSchema = z.object({
  from: z.string().min(1).max(512),
  to: z.array(z.string()).optional(),
  subject: z.string().max(998).optional(),
  text: z.string().max(200_000).optional(),
  html: z.string().max(500_000).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

const AUTO_REPLY_PATTERNS = [
  "auto-reply",
  "auto reply",
  "out of office",
  "delivery status",
  "mailer-daemon",
  "postmaster",
  "undeliverable",
  "automatic reply",
  "autosvar",
];

export const Route = createFileRoute("/api/inbound-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Optional shared-secret check. Resend sends a Svix-style signature header;
        // we accept either x-resend-signature or svix-signature and look for the
        // configured secret substring in it.
        const secret = process.env.INBOUND_WEBHOOK_SECRET;
        if (secret) {
          const sig =
            request.headers.get("x-resend-signature") ??
            request.headers.get("svix-signature") ??
            "";
          if (!sig.includes(secret)) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad Request", { status: 400 });
        }

        const parsed = ResendInboundSchema.safeParse(body);
        if (!parsed.success) {
          return new Response("Invalid payload", { status: 400 });
        }

        const { from, subject, text, html } = parsed.data;

        // "Display Name <user@host>" → name + email
        const fromMatch = from.match(/^(.+?)\s*<(.+)>$/);
        const senderName = fromMatch ? fromMatch[1].trim().replace(/^"|"$/g, "") : null;
        const senderEmail = (fromMatch ? fromMatch[2] : from).trim().toLowerCase();

        const messageBody =
          (text?.trim() ||
            html
              ?.replace(/<style[\s\S]*?<\/style>/gi, " ")
              .replace(/<script[\s\S]*?<\/script>/gi, " ")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()) ||
          "(Ingen meldingstekst)";

        const subjectLower = (subject ?? "").toLowerCase();
        if (AUTO_REPLY_PATTERNS.some((p) => subjectLower.includes(p))) {
          return new Response("Skipped auto-reply", { status: 200 });
        }

        const { error } = await supabaseAdmin.from("contact_tickets").insert({
          source: "epost",
          status: "ny",
          name: senderName,
          email: senderEmail,
          subject: subject?.trim() || "(Intet emne)",
          message: messageBody.slice(0, 50_000),
        });

        if (error) {
          console.error("[inbound-email] insert failed:", error.message);
          return new Response("Internal error", { status: 500 });
        }

        console.log("[inbound-email] ticket created for:", senderEmail);
        return new Response("OK", { status: 200 });
      },
    },
  },
});
