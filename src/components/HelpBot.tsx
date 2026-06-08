import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HelpCircle, X, Send, ThumbsUp, ThumbsDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { helpBotChatFn, helpBotFeedbackFn } from "@/lib/helpbot.functions";
import { useT } from "@/i18n/provider";

type Msg = { role: "user" | "assistant"; content: string };

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function HelpBot() {
  const t = useT();
  const hb = t.app.helpBot;
  const GREETING: Msg = { role: "assistant", content: hb.greeting };
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => newSessionId());
  const [hasUnread, setHasUnread] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = useServerFn(helpBotChatFn);

  useEffect(() => {
    if (open) setHasUnread(false);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await chat({ data: { messages: next.map(({ role, content }) => ({ role, content })) } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: hb.errorReply }]);
    } finally {
      setLoading(false);
    }
  };

  const showQuickReplies = messages.length === 1 && !loading;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={hb.openAria}
          className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6 z-50 grid place-items-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 hover:brightness-110 transition"
        >
          <HelpCircle className="h-7 w-7" strokeWidth={2.2} />
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-background" />
          )}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 z-50 md:w-[380px] md:h-[600px] md:max-h-[85vh] bg-surface md:rounded-2xl md:border md:border-border shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-label={hb.title}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2/50">
            <div className="flex items-center gap-2">
              <span className="grid place-items-center h-8 w-8 rounded-full bg-primary/15 text-primary">🤖</span>
              <div>
                <p className="text-sm font-semibold">{hb.title}</p>
                <p className="text-[10px] text-muted-foreground">{hb.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={hb.close}
              className="p-2 rounded-lg hover:bg-surface-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                msg={m}
                isLast={i === messages.length - 1 && m.role === "assistant" && i > 0}
                question={m.role === "assistant" && i > 0 ? messages[i - 1]?.content ?? "" : ""}
                sessionId={sessionId}
              />
            ))}
            {loading && <TypingDots />}
            {showQuickReplies && (
              <div className="flex flex-col gap-2 pt-1">
                {hb.quickReplies.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="text-left text-sm rounded-xl border border-border bg-surface-2/40 px-3 py-2 hover:bg-surface-2 hover:border-primary transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border p-3 bg-surface-2/30"
          >
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={hb.inputPlaceholder}
                maxLength={1000}
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="grid place-items-center h-10 w-10 rounded-xl bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50"
                aria-label={hb.send}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground text-center">{hb.poweredBy}</p>
          </form>
        </div>
      )}
    </>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl bg-surface-2 px-3 py-3 w-fit">
      <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function MessageBubble({
  msg,
  isLast,
  question,
  sessionId,
}: {
  msg: Msg;
  isLast: boolean;
  question: string;
  sessionId: string;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-primary text-primary-foreground px-3.5 py-2 text-sm whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="max-w-[90%] rounded-2xl bg-surface-2 px-3.5 py-2.5 text-sm prose-veiglede">
        <ReactMarkdown
          components={{
            a: (props) => (
              <a
                {...props}
                className="text-primary underline hover:no-underline"
                target={props.href?.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
              />
            ),
            ul: (props) => <ul {...props} className="list-disc pl-5 my-1 space-y-0.5" />,
            ol: (props) => <ol {...props} className="list-decimal pl-5 my-1 space-y-0.5" />,
            strong: (props) => <strong {...props} className="font-semibold" />,
            p: (props) => <p {...props} className="my-1" />,
          }}
        >
          {msg.content}
        </ReactMarkdown>
      </div>
      {isLast && question && <FeedbackRow sessionId={sessionId} question={question} answer={msg.content} />}
    </div>
  );
}

function FeedbackRow({ sessionId, question, answer }: { sessionId: string; question: string; answer: string }) {
  const t = useT();
  const hb = t.app.helpBot;
  const [state, setState] = useState<"idle" | "up" | "down" | "thanks">("idle");
  const [text, setText] = useState("");
  const feedback = useServerFn(helpBotFeedbackFn);

  const submit = async (helpful: boolean, feedbackText?: string) => {
    try {
      await feedback({ data: { sessionId, question, answer, helpful, feedbackText } });
    } catch {
      /* swallow */
    }
    setState("thanks");
  };

  if (state === "thanks") {
    return <p className="text-[11px] text-muted-foreground pl-1">{hb.thanksFeedback}</p>;
  }
  if (state === "down") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false, text.trim() || undefined);
        }}
        className="flex items-center gap-2 pl-1"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={hb.feedbackPlaceholder}
          maxLength={500}
          className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary"
          autoFocus
        />
        <button type="submit" className="text-xs rounded-lg bg-primary text-primary-foreground px-2.5 py-1.5">
          {hb.send}
        </button>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-2 pl-1">
      <button
        type="button"
        onClick={() => {
          setState("up");
          submit(true);
        }}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
      >
        <ThumbsUp className="h-3 w-3" /> {hb.helpful}
      </button>
      <button
        type="button"
        onClick={() => setState("down")}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
      >
        <ThumbsDown className="h-3 w-3" /> {hb.notHelpful}
      </button>
    </div>
  );
}
