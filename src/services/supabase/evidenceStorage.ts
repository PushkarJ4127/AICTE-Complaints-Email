import { supabase, isSupabaseConfigured } from './client';

/**
 * Best-effort upload of evidence files to the private "evidence" bucket.
 * Returns one path (or null) per file. Never throws: if the bucket is missing
 * the complaint is still filed and the AI findings are still saved.
 */
export async function uploadEvidenceFiles(files: File[]): Promise<Array<string | null>> {
  if (!isSupabaseConfigured()) return files.map(() => null);
  const folder = `pending/${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now()}`;
  const results: Array<string | null> = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${folder}/${safeName}`;
    try {
      const { error } = await supabase.storage.from('evidence').upload(path, file, { contentType: file.type || undefined, upsert: false });
      results.push(error ? null : path);
    } catch {
      results.push(null);
    }
  }
  return results;
}

/** Officer-side: temporary link to open an uploaded file. */
export async function getEvidenceUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from('evidence').createSignedUrl(path, 300);
    return error ? null : data.signedUrl;
  } catch {
    return null;
  }
}
