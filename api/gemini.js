export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Chave de API não encontrada nas variáveis de ambiente do servidor." });
  }

  try {
    const { parts } = req.body;
    if (!parts || !Array.isArray(parts)) {
      return res.status(400).json({ error: "Payload 'parts' inválido" });
    }

    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }] }),
      }
    );

    if (!googleResponse.ok) {
      const errText = await googleResponse.text().catch(() => "");
      return res.status(googleResponse.status).json({ error: `Erro Google Gemini: ${errText}` });
    }

    const data = await googleResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";

    return res.status(200).json({ text });
  } catch (err) {
    console.error("Erro na Serverless Function Gemini:", err);
    return res.status(500).json({ error: "Erro interno no servidor proxy" });
  }
}
