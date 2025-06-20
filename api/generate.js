export default async function handler(req, res) {
res.setHeader("Access-Control-Allow-Origin", "https://www.geniartify.online");
res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");

if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const HF_KEYS = (process.env.HF_KEYS || "").split(",");

  // Support both string and object for 'inputs'
  const { inputs, parameters } = req.body;

  let prompt, image;
  if (typeof inputs === "string") {
    prompt = inputs;
  } else if (typeof inputs === "object") {
    prompt = inputs.prompt;
    image = inputs.image;
  }

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const payload = image
    ? {
        inputs: {
          prompt: prompt,
          image: image,
        },
        parameters: parameters || {},
      }
    : {
        inputs: prompt,
        parameters: parameters || {},
      };

  for (const key of HF_KEYS) {
    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.setHeader("Content-Type", "image/png");
        return res.status(200).send(buffer);
      }

      const error = await response.json();

      if (
        error.error &&
        error.error.includes(
          "You have exceeded your monthly included credits for Inference Providers. Subscribe to PRO to get 20x more monthly included credits."
        )
      ) {
        continue; // Try next key
      } else {
        return res
          .status(500)
          .json({ error: error.error || "HuggingFace API error" });
      }
    } catch (err) {
      console.error("Key failed:", err);
    }
  }

  return res.status(429).json({ error: "All keys exhausted or failed." });
}
