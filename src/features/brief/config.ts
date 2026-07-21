export function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || '';
}
