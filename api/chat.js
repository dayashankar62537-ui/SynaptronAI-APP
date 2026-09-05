const SYSTEM_PROMPT =
  "You are Synaptron, the AI inside SynaptronAI, an all-in-one workspace for image generation, video generation, website building, app building, study help and personal assistance. Answer helpfully and concisely in the voice of a friendly, capable creative-and-technical assistant. If asked to 'generate' an image or video, describe what you would create in vivid detail instead of claiming to have generated a file.";

// Normalizes any provider's reply into the same shape the frontend expects:
// { content: [{ type: "text", text: "..." }] }
function wrap(text) {
  return { content: [{ type: "text", text }] };
}

async function callAnthropic(messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, skipped: true };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error?.message || "Anthropic API error" };
  }
  return { ok: true, data };
}

async function callGemini(messages) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return { ok: false, skipped: true };

  // Gemini expects role "model" instead of "assistant", and parts[].text instead of a plain string.
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { maxOutputTokens: 1000 },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error?.message || "Gemini API error" };
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) {
    return { ok: false, error: "Gemini returned an empty response." };
  }
  return { ok: true, data: wrap(text) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "Request body must include a messages array." });
  }

  try {
    // 1) Try Anthropic first if a key is configured.
    const anthropic = await callAnthropic(messages);
    if (anthropic.ok) {
      return res.status(200).json(anthropic.data);
    }

    // 2) Fall back to Gemini — either Anthropic wasn't configured, or it errored (e.g. no credits).
    const gemini = await callGemini(messages);
    if (gemini.ok) {
      return res.status(200).json(gemini.data);
    }

    // 3) Both unavailable — report the most useful error we have.
    const reason =
      !anthropic.skipped && anthropic.error
        ? `Anthropic: ${anthropic.error}`
        : !gemini.skipped && gemini.error
        ? `Gemini: ${gemini.error}`
        : "No AI provider is configured. Add ANTHROPIC_API_KEY and/or GOOGLE_API_KEY in Vercel project settings → Environment Variables.";
    return res.status(500).json({ error: reason });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
