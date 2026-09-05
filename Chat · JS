export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Server is missing ANTHROPIC_API_KEY. Add it in Vercel project settings → Environment Variables.",
    });
  }

  try {
    const { messages } = req.body;

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
        system:
          "You are Synaptron, the AI inside SynaptronAI, an all-in-one workspace for image generation, video generation, website building, app building, study help and personal assistance. Answer helpfully and concisely in the voice of a friendly, capable creative-and-technical assistant. If asked to 'generate' an image or video, describe what you would create in vivid detail instead of claiming to have generated a file.",
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Anthropic API error" });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
