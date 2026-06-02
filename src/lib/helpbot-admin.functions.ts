import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.role !== "admin" || data.is_active === false) {
    throw new Error("Forbidden");
  }
}

type Row = {
  question: string;
  answer: string;
  helpful: boolean;
  feedback_text: string | null;
  created_at: string;
};

const STOPWORDS = new Set([
  "hva","hvor","hvordan","kan","jeg","du","er","det","en","et","den","de","på","i","til","for","av","som","og","eller","med","ikke","har","være","blir","har","så","mer","mest","best","beste","veiglede","app","appen","min","mine","mitt","ny","gammelt","nytt","skal","vil","får","får","hjelp","hjelpe","spørsmål","veit","vet","tror","mener","fra","etter","før","når","ved","om","sin","sitt","sine","seg","kun","bare","også","nå","hei","hello","hi","please","what","how","where","why","when","the","is","a","an","of","to","for","and","or","with","not"
]);

function topKeywords(rows: Row[], n: number) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const tokens = r.question
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
    const seen = new Set<string>();
    for (const t of tokens) {
      if (seen.has(t)) continue;
      seen.add(t);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([keyword, count]) => ({ keyword, count }));
}

export const helpBotInsightsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("help_bot_feedback")
      .select("question, answer, helpful, feedback_text, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];

    const total = rows.length;
    const helpful = rows.filter((r) => r.helpful).length;
    const satisfaction = total === 0 ? 0 : Math.round((helpful / total) * 100);

    const unhelpful = rows
      .filter((r) => !r.helpful)
      .slice(0, 40)
      .map((r) => ({
        question: r.question,
        answer: r.answer,
        feedback: r.feedback_text,
        createdAt: r.created_at,
      }));

    const unanswered = rows
      .filter((r) => /vet jeg ikke|don't know|do not know|ikke sikkert/i.test(r.answer))
      .slice(0, 40)
      .map((r) => ({ question: r.question, createdAt: r.created_at }));

    return {
      total,
      helpful,
      satisfaction,
      topKeywords: topKeywords(rows, 15),
      unhelpful,
      unanswered,
    };
  });
