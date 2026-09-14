# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev        # Vite dev server em http://localhost:5173
npm run build      # gera dist/
npm run preview    # serve o dist/ buildado
npx vercel --prod  # deploy de producao (manual)
```

**Nao existe suite de testes nem linter neste projeto.** A verificacao de qualquer mudanca e: `npm run build` (pega erro de sintaxe/import) + rodar o app de verdade no navegador e exercitar o fluxo alterado. Um build limpo sozinho nao prova que a feature funciona.

**Deploy e manual.** O projeto Vercel nao tem integracao com Git — `git push` nao publica nada. So `npx vercel --prod` publica. O dominio de producao e `calorie-tracker-app-khaki.vercel.app`.

## Arquitetura

### Monolito de um componente

Praticamente todo o app vive em `src/App.jsx` (~3.4k linhas, um unico componente `App`). Landing page de marketing, autenticacao, diario alimentar, treinos, receitas e progresso estao todos nesse arquivo, compartilhando um mesmo escopo de estado. Nao ha pasta de componentes.

Consequencias praticas ao editar:
- Todo estado novo entra como mais um `useState` no corpo do componente. Funcoes declaradas com `function` sao hoisted, entao helpers como `parseJsonResponse` podem ser chamados por codigo que aparece antes deles no arquivo.
- Ha dois niveis de navegacao: `viewMode` (`"landing"` | `"app"`) e, dentro do app, `activeTab` (`"food"` | `"workout"` | `"recipe"` | `"progress"`).
- O app funciona **sem login** — `setViewMode("app")` entra direto no painel e tudo cai no localStorage.

Outros arquivos: `src/lib/firebase.js` (auth + acesso ao Firestore), `src/lib/gemini.js` (chamada de IA no cliente), `src/lib/storage.js` (polyfill de `window.storage`), `api/gemini.js` (Vercel Function que esconde a chave da IA).

### Persistencia dupla: Firestore + localStorage

**Este e o ponto que mais gera bug no projeto.** Todo dado do usuario tem dois destinos e um padrao fixo de leitura/escrita:

```js
// LER: remoto primeiro, cai pro local se o remoto vier VAZIO
if (currentUser) {
  const remote = await getUserFoodLog(currentUser.uid, dateKey);
  if (remote && remote.length > 0) { setEntries(remote); return; }
}
const result = await window.storage.get(key, false);   // fallback local
setEntries(result ? JSON.parse(result.value) : []);

// GRAVAR: remoto quando logado, e SEMPRE tambem no local
async function persist(next) {
  setEntries(next);
  if (currentUser) await saveUserFoodLog(currentUser.uid, todayKey(date), next);
  await window.storage.set(key, JSON.stringify(next), false);
}
```

Armadilhas concretas desse padrao:

- As funcoes de leitura em `firebase.js` **engolem o erro e retornam `[]`/`null`** em vez de lancar. Uma falha de permissao do Firestore chega ao App.jsx indistinguivel de "nao ha dado".
- `[]` e truthy em JavaScript. Checar `if (remote)` em vez de `if (remote && remote.length > 0)` faz o codigo aceitar uma lista vazia como dado valido e **nunca** cair no fallback local — foi exatamente essa a causa do resumo semanal aparecer zerado. Ao escrever leitura nova, inicialize a variavel acumuladora com `null`, nao com `[]`, senao o `if (!arr)` do fallback nunca dispara.
- Como o local sempre e escrito e nao e isolado por usuario, dados de uma conta podem reaparecer em outra no mesmo navegador quando o remoto vier vazio. Limitacao conhecida, ainda nao resolvida.

Modelo no Firestore (`src/lib/firebase.js`):

| Caminho | Conteudo |
|---|---|
| `users/{uid}` | campo `profile` (peso, altura, idade, sexo, atividade, objetivo) |
| `users/{uid}/foodlogs/{YYYY-MM-DD}` | `entries[]` |
| `users/{uid}/workouts/{YYYY-MM-DD}` | `items[]` |
| `users/{uid}/weighins/{YYYY-MM-DD}` | `weight` |
| `users/{uid}/measurements/history` | `entries[]` (doc unico, historico livre — medidas nao sao diarias) |

Chaves de localStorage: `foodlog:{data}`, `workout:{data}`, `weight:{data}`, `profile`, `measurements-history` (todas via `window.storage`, agrupadas sob `calorie-tracker:data:v1`), mais `calorie-tracker:theme`, `calorie-tracker:lgpd-consent` e `calorie-tracker:gemini-api-key` (acesso direto).

`src/lib/storage.js` instala `window.storage` em `main.jsx` antes do render — e um polyfill do storage do artifact do Claude, de onde o app foi exportado. Por isso a assinatura estranha `get(key, false)` / `set(key, value, false)`; o terceiro argumento e ignorado.

**As regras de seguranca do Firestore nao estao no repositorio** e nao dao pra verificar por aqui.

### Chamadas de IA (Gemini)

Tudo passa por `callGemini(parts)` em `src/lib/gemini.js`, que tenta em ordem:

1. `POST /api/gemini` — Vercel Function que injeta `GEMINI_API_KEY` do ambiente do servidor. **Caminho usado em producao.**
2. Fallback direto para a API do Google usando uma chave que o proprio usuario cola na UI, guardada em `localStorage`.

Regras que importam:

- **Nunca prefixe a chave da Gemini com `VITE_`.** O Vite inlina qualquer `import.meta.env.VITE_*` em texto puro no bundle, o que ja vazou a chave real uma vez. O nome correto e `GEMINI_API_KEY`, sem prefixo, lido so no servidor.
- `npm run dev` **nao roda Vercel Functions**, entao `/api/gemini` responde 404 em desenvolvimento e o app cai no fallback. Para testar IA localmente, injete uma chave: `localStorage.setItem("calorie-tracker:gemini-api-key", "<chave>")`.
- Os dois caminhos mandam `generationConfig: { thinkingConfig: { thinkingBudget: 0 } }`. O `gemini-2.5-flash` liga "thinking" por padrao e analises longas levavam ~36s; sem thinking caem para ~5s. Mantenha isso ao mexer nas chamadas.
- O modelo as vezes devolve **503 "high demand"** — transitorio, do lado do Google, nao e bug do app.

O app pede JSON em todos os prompts e usa dois parsers, ambos tolerantes a resposta embrulhada em bloco markdown:
- `parseJsonResponse(text)` — extrai um **objeto** (`/\{[\s\S]*\}/`). Nao funciona para arrays.
- `parseWorkoutListResponse(text)` — extrai um **array** (`/\[[\s\S]*\]/`). Use este quando a IA devolver lista.

Features de IA hoje: foto do prato, leitura de codigo de barras (com Open Food Facts primeiro e IA como fallback), leitura de ficha de treino por foto, Chef IA de receitas, dicas por objetivo, analise do treino do dia, preenchimento automatico de macros e analise da alimentacao do dia.

### Metas caloricas

`computeGoals(profile)` no topo do `App.jsx` calcula BMR (Mifflin-St Jeor), aplica multiplicador de atividade para o TDEE e ajusta pelo objetivo: `emagrecimento` -500 kcal com piso de 1200 e 2,1 g de proteina/kg; `hipertrofia` +250 kcal e 2,2 g/kg; `resistencia` mantem o TDEE com 1,8 g/kg. Gordura e fixa em 0,87 g/kg e o carboidrato e o que sobra das calorias. Treino registrado no dia **aumenta** a meta do dia: as calorias gastas viram margem extra (`effectiveGoalCalories`), entao o mesmo dia tem meta diferente conforme o treino.

Cuidado: existem dois conceitos de objetivo separados. `profile.goal` (3 opcoes) alimenta a matematica calorica; `trainingGoal` (5 opcoes, estado compartilhado entre as abas Treinos e Diario) so da contexto para os prompts de IA.

## Convencoes

- **Toda a UI e em portugues brasileiro**, incluindo prompts de IA e mensagens de erro. Commits tambem em portugues, sem acentos.
- Tailwind com `darkMode: 'class'`, alternado na raiz do documento e persistido em `calorie-tracker:theme`. Todo bloco novo precisa das variantes `dark:`.
- Padrao visual dos cards: `bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-md border border-slate-200/80 dark:border-slate-800`. Verde esmeralda e a cor primaria; features de IA usam violeta.
- Fluxo padrao das features de IA: botao → estado de loading com `Loader2` girando → resultado editavel ou revisavel → confirmar/descartar. Onde faz sentido, a acao so libera depois que ha dado do dia (ex: analise de treino exige treino salvo).
- Assinatura "desenvolvido por augefw" no cabecalho e rodape; banner de LGPD no rodape.
- `docs/RELATORIO_E_BOAS_PRATICAS.md` registra as decisoes de arquitetura e o checklist de padroes do autor. A secao do README sobre a chave de API ficou desatualizada — descreve o estado anterior ao proxy serverless.
