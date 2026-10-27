/**
 * Small shared helper for calling Gemini and getting JSON back.
 * Uses the same VITE_GEMINI_API_KEY and model fallbacks as the complaint advisor.
 */
import { GoogleGenerativeAI, type Part } from '@google/generative-ai';

const MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];

export function getGeminiKey(): string | null {
  const raw = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const key = raw ? raw.trim() : '';
  return key && key !== 'undefined' ? key : null;
}

export function isGeminiConfigured(): boolean {
  return getGeminiKey() !== null;
}

export async function generateJson<T>(system: string, parts: Part[]): Promise<T> {
  const key = getGeminiKey();
  if (!key) throw new Error('Gemini API key not configured (VITE_GEMINI_API_KEY).');

  const genAI = new GoogleGenerativeAI(key);
  let lastError: Error | null = null;

  for (const name of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: name,
        systemInstruction: system,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      });
      const result = await model.generateContent(parts);
      const text = result.response.text().trim();
      if (!text) continue;
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      try {
        return JSON.parse(cleaned) as T;
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]) as T;
        throw new Error('AI returned an unstructured response.');
      }
    } catch (err) {
      lastError = err as Error;
      console.warn(`Gemini model ${name} failed:`, lastError.message);
    }
  }
  throw lastError || new Error('Gemini request failed.');
}
