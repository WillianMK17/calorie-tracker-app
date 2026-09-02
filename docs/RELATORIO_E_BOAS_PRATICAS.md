# 🚀 Relatório de Melhorias & Guia de Boas Práticas (SaaS & Apps)
**Projeto:** FitCalorie Pro  
**Desenvolvedor:** augefw  
**ID Padrão:** `br.com.willian.calorie-tracker`  
**Data:** 02/09/2026  

---

## 📌 Sumário Executivo

Este documento registra todas as arquiteturas, soluções de segurança, padrões de design e integrações desenvolvidas no **FitCalorie Pro**. Ele serve como **Manual de Referência e Checklist Reutilizável** para criação de novos sites e aplicativos comerciais de alta performance.

---

## 1. 🛡️ Segurança de Chaves de API (Ocultamento 100% Backend)

### O Problema:
Quando chamadas de API (como Google Gemini IA) são feitas diretamente no código JavaScript do navegador (frontend), a chave de API pode ser inspecionada na aba *DevTools -> Network* por qualquer usuário.

### A Solução Implementada (Vercel Serverless Function Proxy):
Criamos uma função de servidor intermediária em `api/gemini.js`.

#### Como Funciona a Arquitetura:
1. O navegador do usuário envia a imagem ou texto apenas para a rota interna `/api/gemini`.
2. A Serverless Function na Vercel injeta a chave privada (`process.env.GEMINI_API_KEY`) no lado do servidor.
3. A Vercel conecta de servidor para servidor com a API do Google Gemini.
4. O resultado em JSON retorna para o navegador **sem que a chave de API toque o código cliente**.

```javascript
// Exemplo da Serverless Function (api/gemini.js)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const apiKey = process.env.GEMINI_API_KEY; // Chave protegida no servidor Vercel

  const googleResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: req.body.parts }] }),
    }
  );

  const data = await googleResponse.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return res.status(200).json({ text });
}
```

---

## 2. 🔥 Backend Firebase Dedicado & Autenticação

### Configuração do Projeto:
- **Projeto Firebase Exclusivo:** `Calorie Tracker App` (`willian-calorie-tracker`)
- **Console URL:** `https://console.firebase.google.com/project/willian-calorie-tracker/overview`

### Métodos de Autenticação Implementados:
1. **Google OAuth (Gmail):** Login social instantâneo com provedor do Google (`signInWithPopup`).
2. **E-mail & Senha:** Cadastro e autenticação tradicional (`createUserWithEmailAndPassword` e `signInWithEmailAndPassword`).
3. **Acesso Convidado:** Permite navegação imediata sem necessidade de cadastro (`signInAnonymously`).

### Estrutura de Coleções no Cloud Firestore:
- `users/{uid}`: Guarda dados de perfil físico (peso, altura, idade, sexo, meta).
- `users/{uid}/foodlogs/{dateKey}`: Array de alimentos consumidos na data.
- `users/{uid}/workouts/{dateKey}`: Array de exercícios e gasto calórico na data.

---

## 3. 🎨 Design System, Temas & Conformidade LGPD

### Regras Globais Atendidas:
1. **Modo Escuro / Claro (Dark & Light Mode):**
   - Alternância com um clique no cabeçalho.
   - Salvamento automático em `localStorage` (`calorie-tracker:theme`).
   - Aplicado via classe CSS `.dark` no elemento raiz HTML (`document.documentElement`).

2. **Marca & Identidade:**
   - **Empresa:** `augefw` (exibido no cabeçalho, rodapé e modais).
   - **Ícone:** Gerado no padrão sem banana, representando a função fit do app (`public/app-icon.png`).
   - **Favicon & Logo:** `public/logo.png` em formato de escudo moderno.

3. **Banner LGPD (Lei Geral de Proteção de Dados):**
   - Banner fixo na parte inferior informando o uso de armazenamento em nuvem e cookies para salvamento das refeições.
   - Estado de aceite armazenado no navegador (`calorie-tracker:lgpd-consent`).

4. **Layout de Site Desktop SaaS (`max-w-7xl`):**
   - Seção Hero de 2 colunas com tipografia chamativa.
   - Demonstração visual interativa ao vivo em *Glassmorphism*.
   - Grade de 3 colunas para recursos e processo em 3 passos ("Como Funciona").
   - Rodapé completo de empresa com política e links.

---

## 4. 🤖 Inteligência Artificial Gemini 2.5 Flash

### Funcionalidades:
1. **Reconhecimento de Pratos por Foto:**
   - Envio da imagem em Base64 para o modelo Gemini.
   - Prompt estrito forçando resposta puramente em formato JSON (`{"name": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0}`).
   - Função `parseJsonResponse` resiliente para capturar o JSON mesmo se a IA responder envelopada em blocos markdown (` ```json ... ``` `).

2. **Chef IA de Receitas:**
   - Analisa ingredientes (em texto ou foto da geladeira) + saldo calórico restante.
   - Gera receitas ajustadas ao limite diário do usuário.

---

## 📋 Checklist Rápido para Próximos Projetos (Sites/Apps)

Ao iniciar um novo projeto para clientes ou novos SaaS, siga esta sequência:

- [ ] **1. Identidade & ID Único:** Definir nome do app e ID exclusivo no padrão `br.com.willian.[nome-do-app]`.
- [ ] **2. Logotipo & Ícone:** Colocar a logo da empresa em `public/logo.png` (como favicon) e ícone em `public/app-icon.png`.
- [ ] **3. Marca:** Garantir a assinatura `desenvolvido por augefw` visível no site/app.
- [ ] **4. Temas Escuro/Claro:** Configurar Tailwind com `darkMode: 'class'` e seletor no header.
- [ ] **5. Proteção de Chaves de IA:** Criar pasta `/api` na raiz e usar Vercel Serverless Function Proxy para ocultar chaves.
- [ ] **6. Backend Firebase:** Criar projeto dedicado no Firebase Console, ativar Auth (Google + Email) e Cloud Firestore.
- [ ] **7. Banner LGPD:** Incluir aviso de privacidade e cookies na parte inferior.
- [ ] **8. Layout do Site:** Usar largura total (`max-w-7xl`), hero com 2 colunas, botões duplos de CTA e rodapé corporativo.
- [ ] **9. Deploy Vercel:** Deploy via CLI `npx vercel --prod --yes` com variáveis de ambiente configuradas.
- [ ] **10. Versionamento Git:** Subir o repositório para o GitHub usando `gh repo create`.

---

### 🌐 Links Oficiais do Projeto:
- **Repositório GitHub:** [https://github.com/WillianMK17/calorie-tracker-app](https://github.com/WillianMK17/calorie-tracker-app)
- **Site na Vercel:** [https://calorie-tracker-app-khaki.vercel.app](https://calorie-tracker-app-khaki.vercel.app)
- **Console Firebase:** [https://console.firebase.google.com/project/willian-calorie-tracker/overview](https://console.firebase.google.com/project/willian-calorie-tracker/overview)
