/**
 * Multilingual complaint intake.
 *
 * A citizen can type or speak in Hindi, Marathi, Tamil, etc. Gemini detects the
 * language, translates to English for the officers, writes a short title and
 * picks the right violation category. The original words are always kept.
 *
 * If no Gemini key is set, we still detect the script and guess the category
 * from keywords so the form keeps working (translation is then skipped).
 */
import { generateJson, isGeminiConfigured } from './geminiClient';
import { normalizeDigits } from '../evidence/amounts';

export interface IntakeLanguage {
  /** BCP-47 code used by the browser speech recogniser */
  code: string;
  /** Name shown in the dropdown */
  label: string;
  /** English name sent to Gemini */
  name: string;
}

export const INTAKE_LANGUAGES: IntakeLanguage[] = [
  { code: 'en-IN', label: 'English', name: 'English' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', name: 'Hindi' },
  { code: 'mr-IN', label: 'मराठी (Marathi)', name: 'Marathi' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)', name: 'Tamil' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)', name: 'Telugu' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)', name: 'Bengali' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)', name: 'Gujarati' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)', name: 'Kannada' },
  { code: 'ml-IN', label: 'മലയാളം (Malayalam)', name: 'Malayalam' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ (Punjabi)', name: 'Punjabi' },
];

export interface IntakeAnalysis {
  detected_language: string; // e.g. "Hindi"
  detected_language_code: string; // e.g. "hi-IN"
  english_title: string;
  english_description: string;
  category: string;
  summary: string;
  used_ai: boolean;
  note?: string;
}

// ---------------------------------------------------------------------------
// Script detection (works offline)
// ---------------------------------------------------------------------------
const SCRIPTS: Array<{ re: RegExp; code: string; name: string }> = [
  { re: /[ऀ-ॿ]/, code: 'hi-IN', name: 'Hindi / Marathi (Devanagari)' },
  { re: /[஀-௿]/, code: 'ta-IN', name: 'Tamil' },
  { re: /[ఀ-౿]/, code: 'te-IN', name: 'Telugu' },
  { re: /[ঀ-৿]/, code: 'bn-IN', name: 'Bengali' },
  { re: /[઀-૿]/, code: 'gu-IN', name: 'Gujarati' },
  { re: /[ಀ-೿]/, code: 'kn-IN', name: 'Kannada' },
  { re: /[ഀ-ൿ]/, code: 'ml-IN', name: 'Malayalam' },
  { re: /[਀-੿]/, code: 'pa-IN', name: 'Punjabi' },
];

export function detectScript(text: string): { code: string; name: string } {
  for (const s of SCRIPTS) if (s.re.test(text)) return { code: s.code, name: s.name };
  return { code: 'en-IN', name: 'English' };
}

export function isNonEnglish(text: string): boolean {
  return detectScript(text).code !== 'en-IN';
}

// ---------------------------------------------------------------------------
// Offline category guess from keywords in several languages
// ---------------------------------------------------------------------------
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Fee Cap Violation': ['fee', 'fees', 'capitation', 'फीस', 'शुल्क', 'फी ', 'கட்டணம்', 'ఫీజు', 'ఫీజ్', 'ফি', 'ફી', 'ಶುಲ್ಕ', 'ഫീസ്', 'ਫੀਸ'],
  'Non-Refund of Security Deposit': ['refund', 'deposit', 'वापस', 'रिफंड', 'जमा', 'திரும்ப', 'వాపసు', 'ফেরত', 'પરત', 'ಮರುಪಾವತಿ', 'തിരികെ', 'ਵਾਪਸ'],
  'Withholding of Original Certificates': ['certificate', 'marksheet', 'documents', 'प्रमाणपत्र', 'सर्टिफिकेट', 'मूल', 'சான்றிதழ்', 'సర్టిఫికెట్', 'সার্টিফিকেট', 'પ્રમાણપત્ર', 'ಪ್ರಮಾಣಪತ್ರ', 'സർട്ടിഫിക്കറ്റ്', 'ਸਰਟੀਫਿਕੇਟ'],
  'Faculty Deficiency & Non-Payment of Remuneration': ['faculty', 'teacher', 'salary', 'professor', 'शिक्षक', 'प्राध्यापक', 'वेतन', 'पगार', 'ஆசிரியர்', 'சம்பளம்', 'ఉపాధ్యాయ', 'జీతం', 'শিক্ষক', 'বেতন', 'શિક્ષક', 'પગાર', 'ಶಿಕ್ಷಕ', 'ಸಂಬಳ', 'അധ്യാപക', 'ശമ്പളം', 'ਅਧਿਆਪਕ', 'ਤਨਖਾਹ'],
  'Unauthorized Course Operation': ['unauthorised', 'unauthorized', 'unapproved', 'without approval', 'अनधिकृत', 'मान्यता', 'அங்கீகாரம்', 'అనుమతి', 'অনুমোদন'],
  'Ragging & Student Harassment': ['ragging', 'harass', 'bully', 'threat', 'रैगिंग', 'छेड़', 'धमकी', 'त्रास', 'ராகிங்', 'ర్యాగింగ్', 'র‍্যাগিং', 'રેગિંગ', 'ರ್ಯಾಗಿಂಗ್', 'റാഗിംഗ്', 'ਰੈਗਿੰਗ'],
  'Infrastructure & Lab Non-Compliance': ['lab', 'laboratory', 'hostel', 'infrastructure', 'building', 'लैब', 'प्रयोगशाला', 'छात्रावास', 'ஆய்வகம்', 'ల్యాబ్', 'ল্যাব', 'લેબ', 'ಪ್ರಯೋಗಾಲಯ', 'ലാബ്', 'ਲੈਬ'],
  'Governance & Administrative Malpractice': ['corruption', 'bribe', 'malpractice', 'fraud', 'भ्रष्टाचार', 'रिश्वत', 'घोटाला', 'ஊழல்', 'లంచం', 'দুর্নীতি', 'ભ્રષ્ટાચાર', 'ಭ್ರಷ್ಟಾಚಾರ', 'അഴിമതി', 'ਭ੍ਰਿਸ਼ਟਾਚਾਰ'],
  'Admission Irregularity': ['admission', 'seat', 'quota', 'प्रवेश', 'दाखिला', 'சேர்க்கை', 'ప్రవేశం', 'ভর্তি', 'પ્રવેશ', 'ಪ್ರವೇಶ', 'പ്രവേശനം', 'ਦਾਖਲਾ'],
};

export function guessCategory(text: string, allowed: string[]): string {
  const lower = normalizeDigits(text).toLowerCase();
  let best = '';
  let bestHits = 0;
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (!allowed.includes(cat)) continue;
    const hits = words.filter((w) => lower.includes(w.toLowerCase())).length;
    if (hits > bestHits) {
      best = cat;
      bestHits = hits;
    }
  }
  return best || allowed[0];
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------
const SYSTEM = `You help AICTE (India's technical education regulator) register grievances from students, parents and faculty who may write or speak in any Indian language, or a mix such as Hinglish.

Return ONLY JSON:
{
  "detected_language": "English name of the main language, e.g. Hindi",
  "detected_language_code": "BCP-47 code such as hi-IN, mr-IN, ta-IN, te-IN, bn-IN, gu-IN, kn-IN, ml-IN, pa-IN or en-IN",
  "english_title": "short formal title in English, max 100 characters",
  "english_description": "faithful English translation of everything the person said, written in clear, formal, chronological sentences",
  "category": "EXACTLY one value from the allowed category list",
  "summary": "one plain sentence for the complainant confirming what you understood"
}

Rules:
- Do NOT add facts, names, dates or amounts that the person did not say.
- Keep every number, amount (for example ₹90,000), date, name and institution name exactly as spoken.
- If the text is already English, only tidy the grammar lightly.
- Speech-to-text can contain mistakes. Use context to read them sensibly but never invent details.`;

export async function analyzeMultilingualComplaint(
  text: string,
  allowedCategories: string[],
  hintLanguageCode?: string
): Promise<IntakeAnalysis> {
  const clean = text.trim();
  const script = detectScript(clean);
  const hinted = INTAKE_LANGUAGES.find((l) => l.code === hintLanguageCode);

  const offline = (note: string): IntakeAnalysis => {
    const lang = script.code === 'en-IN' && hinted ? hinted : INTAKE_LANGUAGES.find((l) => l.code === script.code) || INTAKE_LANGUAGES[0];
    const firstLine = clean.split(/[\n.।]/)[0].trim();
    return {
      detected_language: script.code === 'hi-IN' && hinted?.code === 'mr-IN' ? 'Marathi' : lang.name,
      detected_language_code: script.code === 'hi-IN' && hinted?.code === 'mr-IN' ? 'mr-IN' : lang.code,
      english_title: firstLine.slice(0, 100),
      english_description: clean,
      category: guessCategory(clean, allowedCategories),
      summary: 'Category was guessed from keywords. Translation was skipped.',
      used_ai: false,
      note,
    };
  };

  if (!clean) throw new Error('Please type or speak your grievance first.');
  if (!isGeminiConfigured()) {
    return offline('AI translation needs VITE_GEMINI_API_KEY. Your original text will be sent as it is.');
  }

  try {
    const res = await generateJson<Partial<IntakeAnalysis>>(SYSTEM, [
      {
        text: `Allowed categories:\n${allowedCategories.map((c) => `- ${c}`).join('\n')}\n\nLanguage hint from the speaker's microphone setting: ${hinted?.name || 'none'}\n\nComplainant's words:\n"""${clean}"""`,
      },
    ]);
    const category = allowedCategories.includes(res.category || '') ? (res.category as string) : guessCategory(clean, allowedCategories);
    return {
      detected_language: res.detected_language || script.name,
      detected_language_code: res.detected_language_code || script.code,
      english_title: (res.english_title || '').slice(0, 120),
      english_description: res.english_description || clean,
      category,
      summary: res.summary || 'Your grievance was translated and categorised.',
      used_ai: true,
    };
  } catch (err) {
    console.warn('Multilingual analysis failed, using offline fallback:', err);
    return offline('AI translation is not reachable right now. Your original text will be sent as it is.');
  }
}
