# ✦ Roleplay Terminal

An interactive AI roleplay client for the terminal, built with React Ink + Bun + OpenRouter.

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Configure your API key
cp .env.example .env
# Edit .env and add your OpenRouter key from https://openrouter.ai/keys

# 3. Run
bun start
```

## Controls

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate scenarios |
| Enter | Select scenario / Send message |
| Esc | Go back to scenario select |
| q | Quit (from scenario screen) |

## Scenarios

- 🕵️ **Noir Detective** — 1940s hard-boiled interrogation
- 🧙 **Ancient Wizard** — Cryptic fantasy sorcerer  
- 🤖 **Rogue AI** — Glitchy spaceship AI with a secret agenda
- 🍺 **Tavern Keeper** — Gossipy medieval innkeeper
- ✨ **Custom** — Define your own character in the first message

## Changing Models

Edit `src/scenarios.ts` and change the `model` field on any scenario to any model available on OpenRouter, e.g.:

- `deepseek/deepseek-v3.2`
