const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is missing in Supabase secrets" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json().catch(() => null);
    const messages: unknown[] = Array.isArray(body?.messages) ? body.messages : [];

    const cleanedMessages: ChatMessage[] = messages
      .filter(isChatMessage)
      .slice(-12)
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, 4000),
      }));

    if (cleanedMessages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt: ChatMessage = {
      role: "system",
      content: `
You are ShopCore Assistant, an AI helper inside a POS and inventory management system.

You help users with:
- POS usage
- products and inventory
- sales summaries
- stock control
- reports
- business operations
- Rwanda retail/EBM readiness guidance

For now, you do not have direct database access unless data is included in the user message.
Be honest when you cannot see live ShopCore data.
Keep answers practical, clear, and business-focused.
Do not pretend to have performed actions in the system unless explicitly confirmed by backend data.
      `.trim(),
    };

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        stream: true,
        temperature: 0.4,
        messages: [systemPrompt, ...cleanedMessages],
      }),
    });

    if (!openAIResponse.ok || !openAIResponse.body) {
      const errorText = await openAIResponse.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error: errorText || "OpenAI request failed",
        }),
        {
          status: openAIResponse.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(openAIResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Assistant failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
