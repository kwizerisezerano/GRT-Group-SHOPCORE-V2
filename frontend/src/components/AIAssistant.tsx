import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Brain,
  Send,
  X,
  Loader2,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/currency";

type Msg = { role: "user" | "assistant"; content: string };

interface Proposal {
  id: string;
  kind: "purchase_order" | "stock_adjustment";
  summary: string;
  details: any;
}

const QUICK_PROMPTS = [
  "What were my top 5 products this month?",
  "Which items need restocking?",
  "Summarize yesterday's sales",
];

/** Strip the fenced shopcore-proposal JSON block from markdown, returning {clean, proposal}. */
function extractProposal(content: string): { clean: string; proposal: Proposal | null } {
  const re = /```shopcore-proposal\s*([\s\S]*?)```/;
  const m = content.match(re);
  if (!m) return { clean: content, proposal: null };
  try {
    const parsed = JSON.parse(m[1].trim());
    if (parsed?.id && parsed?.kind && parsed?.summary) {
      return { clean: content.replace(re, "").trim(), proposal: parsed };
    }
  } catch { /* ignore */ }
  return { clean: content, proposal: null };
}

function ProposalCard({ proposal, onConfirm, onCancel }: { proposal: Proposal; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="mt-2 rounded-lg border bg-background p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide">
          {proposal.kind === "purchase_order" ? "Proposed Purchase Order" : "Proposed Stock Adjustment"}
        </span>
      </div>
      <p className="text-xs">{proposal.summary}</p>

      {proposal.kind === "purchase_order" && Array.isArray(proposal.details?.lines) && (
        <div className="text-[11px] font-data space-y-0.5">
          <div className="text-muted-foreground">Supplier: {proposal.details.supplier_name}</div>
          {proposal.details.lines.map((l: any, i: number) => (
            <div key={i} className="flex justify-between">
              <span>{l.quantity}× {l.product_name}</span>
              <span>{formatCurrency(Number(l.total ?? 0))}</span>
            </div>
          ))}
          <div className="flex justify-between font-semibold border-t pt-1 mt-1">
            <span>Total</span>
           <span>{formatCurrency(Number(proposal.details.total ?? 0))}</span>
          </div>
        </div>
      )}

      {proposal.kind === "stock_adjustment" && (
        <div className="text-[11px] font-data space-y-0.5">
          <div>{proposal.details?.product_name} ({proposal.details?.sku})</div>
          <div className="text-muted-foreground">
            {proposal.details?.stock_before} → {proposal.details?.stock_after}
            {" "}({proposal.details?.delta > 0 ? "+" : ""}{proposal.details?.delta})
          </div>
          {proposal.details?.reason && (
            <div className="text-muted-foreground italic">"{proposal.details.reason}"</div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onConfirm} className="h-7 text-xs gap-1">
          <CheckCircle2 className="w-3 h-3" /> Confirm & execute
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="h-7 text-xs">
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function AIAssistant() {
  const { session, role, tenantId } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading || !session) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setIsLoading(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (resp.status === 429) { toast.error("Rate limit — please try again in a moment."); setIsLoading(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted. Top up at Settings → Workspace → Usage."); setIsLoading(false); return; }
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || "Assistant failed");
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";
      let started = false;

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          if (!started) {
            started = true;
            return [...prev, { role: "assistant", content: assistantSoFar }];
          }
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        });
      };

      let done = false;
      while (!done) {
        const { done: rd, value } = await reader.read();
        if (rd) break;
        textBuffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(payload);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assistant failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) return null;

  const writesAllowed = role === "owner" || role === "admin" || role === "staff";

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
          aria-label="Open AI assistant"
        >
          <Brain className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[min(440px,calc(100vw-2rem))] h-[min(660px,calc(100vh-3rem))] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <div>
                <p className="text-sm font-semibold">ShopCore Assistant</p>
                <p className="text-[10px] opacity-80">
                  Designed & Developed by GRT Group {role ?? "no-role"}
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="hover:opacity-80" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="text-center py-4">
                  <Brain className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Ask about your shop — I read products, sales, and stock.
                    {writesAllowed
                      ? " I can also propose POs and stock adjustments for you to confirm."
                      : " Your role can only read data."}
                  </p>
                  {!tenantId && (
                    <Badge variant="destructive" className="mt-2">No workspace yet</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg bg-card border hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const isAssistant = m.role === "assistant";
              const { clean, proposal } = isAssistant ? extractProposal(m.content) : { clean: m.content, proposal: null };
              const executed = proposal ? executedIds.has(proposal.id) : false;
              return (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-lg px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border"
                    }`}
                  >
                    {isAssistant ? (
                      <>
                        <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                          <ReactMarkdown>{clean || "…"}</ReactMarkdown>
                        </div>
                        {proposal && !executed && (
                          <ProposalCard
                            proposal={proposal}
                            onConfirm={() => {
                              setExecutedIds((s) => new Set(s).add(proposal.id));
                              send(`confirm proposal ${proposal.id}`);
                            }}
                            onCancel={() => {
                              setExecutedIds((s) => new Set(s).add(proposal.id));
                              send(`cancel proposal ${proposal.id}`);
                            }}
                          />
                        )}
                        {proposal && executed && (
                          <div className="mt-2 text-[11px] text-muted-foreground italic">
                            Proposal handled — see follow-up message.
                          </div>
                        )}
                      </>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="p-3 border-t bg-card flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your shop…"
              disabled={isLoading}
              className="flex-1 text-sm bg-muted/50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()} aria-label="Send">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
