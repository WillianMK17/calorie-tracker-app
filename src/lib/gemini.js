const KEY_STORAGE = "calorie-tracker:gemini-api-key";
const MODEL = "gemini-2.5-flash";

// O gemini-2.5-flash usa "thinking" por padrão, o que levava análises mais
// longas a demorar ~36s. Desligando, a mesma resposta sai em ~8s, latência
// aceitável pra alguém esperando na tela.
const GENERATION_CONFIG = { thinkingConfig: { thinkingBudget: 0 } };

export function getApiKey() {
  // Só localStorage: nunca ler de import.meta.env aqui. Qualquer var VITE_*
  // referenciada no código do cliente é embutida em texto puro no bundle
  // pelo Vite, expondo a chave para qualquer visitante do site.
  return localStorage.getItem(KEY_STORAGE) || "";
}

export function setApiKey(key) {
  localStorage.setItem(KEY_STORAGE, key.trim());
}

export function hasApiKey() {
  return true; // Sempre habilitado via Proxy Servidor ou Chave local
}

export async function callGemini(parts) {
  // 1. Tenta chamar a API via Proxy Serverless Seguro (/api/gemini)
  // Onde a chave fica Oculta no Servidor e nunca é exposta no navegador
  try {
    const serverlessRes = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts }),
    });

    if (serverlessRes.ok) {
      const data = await serverlessRes.json();
      if (data && data.text) {
        return data.text;
      }
    }
  } catch (proxyError) {
    console.warn("Serverless API não acessível, tentando fallback direto:", proxyError);
  }

  // 2. Fallback local para desenvolvimento isolado:
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("missing-api-key");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: GENERATION_CONFIG,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("") || "";
  return text;
}
