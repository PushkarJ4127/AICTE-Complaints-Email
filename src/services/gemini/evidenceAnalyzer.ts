/**
 * Evidence reader.
 *
 * Images and PDFs go to Gemini, which reads the document and returns the amount,
 * dates, names and receipt number. Plain text receipts (.txt / .csv) are read
 * in the browser. The comparison with the complaint is done by evaluateEvidence()
 * in services/evidence/amounts.ts (normal code, not AI), so results are predictable.
 */
import { generateJson, isGeminiConfigured } from './geminiClient';
import {
  emptyExtraction,
  evaluateEvidence,
  parseDates,
  parseReceiptText,
  type EvidenceContext,
  type ExtractedFields,
} from '../evidence/amounts';
import type { EvidenceItem } from '../../types/database.types';

export const ACCEPTED_EVIDENCE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'text/csv'];
export const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;

export interface RawExtraction {
  extracted: ExtractedFields;
  document_type: string | null;
  checked_by: EvidenceItem['checked_by'];
  note?: string;
}

const SYSTEM = `You read documents that students and parents attach to fee and admission grievances in India: fee receipts, bank transfer slips, challans, demand letters, offer letters, marksheets.

Return ONLY JSON:
{
  "document_type": "e.g. Fee receipt, Bank slip, Demand notice, Certificate, Other",
  "legible": true or false,
  "amounts": [numbers in rupees, no commas, every money amount printed on the document],
  "primary_amount": number or null (the total amount paid or demanded),
  "dates": ["YYYY-MM-DD", ...],
  "payer_name": "name of the student or payer, or null",
  "institution_name": "college or institute name printed on the document, or null",
  "receipt_number": "receipt, challan or transaction number, or null",
  "summary": "one short sentence saying what the document is"
}

Rules: read only what is printed. Never guess or invent a value. Use null or [] when something is missing or unreadable. Numeric dates on Indian documents are day/month/year.`;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export async function extractFromFile(file: File): Promise<RawExtraction> {
  const isText = file.type === 'text/plain' || file.type === 'text/csv' || /\.(txt|csv)$/i.test(file.name);

  if (isText) {
    const text = await file.text();
    return { extracted: parseReceiptText(text), document_type: 'Text receipt', checked_by: 'text-parser' };
  }

  if (!isGeminiConfigured()) {
    return {
      extracted: emptyExtraction(),
      document_type: null,
      checked_by: 'none',
      note: 'Reading images and PDFs needs VITE_GEMINI_API_KEY.',
    };
  }

  try {
    const data = await fileToBase64(file);
    const res = await generateJson<{
      document_type?: string | null;
      legible?: boolean;
      amounts?: unknown[];
      primary_amount?: number | null;
      dates?: unknown[];
      payer_name?: string | null;
      institution_name?: string | null;
      receipt_number?: string | null;
      summary?: string | null;
    }>(SYSTEM, [{ inlineData: { data, mimeType: file.type || 'application/pdf' } }, { text: 'Extract the fields from this document.' }]);

    const amounts = (res.amounts || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    const primary = res.primary_amount !== null && res.primary_amount !== undefined && Number.isFinite(Number(res.primary_amount)) ? Number(res.primary_amount) : null;
    const dates = (res.dates || [])
      .map(String)
      .flatMap((d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? [d] : parseDates(d)));

    return {
      extracted: {
        amounts,
        primary_amount: primary ?? (amounts.length ? Math.max(...amounts) : null),
        dates: Array.from(new Set(dates)).sort(),
        payer_name: res.payer_name || null,
        institution_name: res.institution_name || null,
        receipt_number: res.receipt_number || null,
        summary: res.summary || null,
      },
      document_type: res.document_type || null,
      checked_by: 'gemini',
    };
  } catch (err) {
    console.warn('Evidence extraction failed:', err);
    return {
      extracted: emptyExtraction(),
      document_type: null,
      checked_by: 'none',
      note: 'AI could not read this file right now.',
    };
  }
}

/** Turn a raw extraction into the final item (with mismatch flags) for the current complaint text. */
export function buildEvidenceItem(file: File, raw: RawExtraction, ctx: EvidenceContext, storagePath?: string | null): EvidenceItem {
  return evaluateEvidence(
    {
      file_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      size: file.size,
      storage_path: storagePath ?? null,
      document_type: raw.document_type,
    },
    raw.extracted,
    raw.checked_by,
    ctx
  );
}

/** A tiny sample receipt so the feature can be demoed without a real file. */
export function makeSampleReceipt(amount = 90000, name = 'Aarav Sharma', institution = 'College of Engineering Pune (COEP)'): File {
  const text = [
    institution,
    'FEE RECEIPT',
    'Receipt No: FR-2026-04412',
    `Received from: ${name}`,
    'Date: 12/08/2026',
    'Course: B.Tech Computer Engineering, Year 2',
    `Total Amount Paid: Rs. ${amount.toLocaleString('en-IN')}/-`,
    'Mode: Online',
  ].join('\n');
  return new File([text], 'sample-fee-receipt.txt', { type: 'text/plain' });
}
