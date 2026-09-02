# Contador de Calorias

App de calorias, macros, treino e receitas, exportado do Claude pra rodar como
projeto normal (React + Vite + Tailwind).

## Rodando no Antigravity

1. Abre a pasta `calorie-tracker-app` inteira no Antigravity (File → Open Folder).
2. Abre o terminal integrado e roda:
   ```
   npm install
   npm run dev
   ```
3. Abre o endereço que aparecer no terminal (normalmente `http://localhost:5173`).

Se quiser, pede pro agente do Antigravity rodar esses dois comandos pra você.

## O que mudou em relação à versão de dentro do Claude

- **Armazenamento**: dentro do Claude os dados ficavam no `window.storage` do
  artifact. Aqui isso foi trocado por `localStorage` do navegador
  (`src/lib/storage.js`). Os dados ficam salvos só nesse navegador, nesse
  computador. Se limpar o cache do navegador, perde o histórico.
- **Análise de foto e gerador de receita**: agora usam a API do Gemini
  (`gemini-2.5-flash`, que tem tier gratuito) em vez do proxy interno do
  Claude. Configura sua chave em "Configurar chave da API", no topo do app.
  Pega uma chave grátis em
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey), não
  precisa cartão de crédito.

## Aviso sobre a chave da API

A chave fica salva só no `localStorage` do seu navegador e é usada direto do
navegador pra chamar a API do Gemini. Isso é adequado pra uso pessoal, no seu
próprio computador. **Não é seguro publicar esse site num link público** com
sua chave configurada, porque qualquer pessoa que abrir o site conseguiria
ver a chave e usar sua cota gratuita (ou gerar cobrança, se você ligar
faturamento na conta). Se quiser publicar de verdade pra outras pessoas
usarem, essa chamada de API precisa passar por um backend seu (uma função
serverless, por exemplo), não direto do navegador.

O tier gratuito do Gemini tem limite de requisições por minuto e por dia
(varia por modelo e muda com o tempo). Pra uso pessoal, registrando algumas
refeições e treinos por dia, é mais do que suficiente.

## Build pra produção

```
npm run build
```

Gera a pasta `dist/` com os arquivos estáticos prontos, que podem ser
hospedados em qualquer lugar (Vercel, Netlify, GitHub Pages etc.) — mantendo
o aviso acima sobre a chave da API.

## Estrutura

```
src/
  App.jsx           — o app inteiro (interface, lógica, tudo)
  main.jsx          — ponto de entrada, instala o polyfill de storage
  index.css         — Tailwind + fontes
  lib/
    storage.js       — localStorage no lugar do window.storage do Claude
    gemini.js         — chamadas à API do Gemini com chave própria
```
