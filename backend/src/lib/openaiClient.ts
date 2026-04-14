import OpenAI from "openai";

/**
 * OpenAI SDK client. Use `OPENAI_BASE_URL` for OpenAI-compatible proxies
 * (e.g. ChatAnyWhere `https://api.chatanywhere.tech/v1`).
 */
export function createOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  return new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
}
