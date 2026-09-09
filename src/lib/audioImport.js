import { supabase } from './supabase'

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/opus', 'audio/flac', 'video/webm']
export function validateAudioFile(file) { if (!file) throw new Error('Choose an audio file.'); if (file.size > MAX_UPLOAD_BYTES) throw new Error('Audio files must be 500 MB or smaller.'); if (!AUDIO_TYPES.includes(file.type) && !/\.(mp3|wav|m4a|aac|ogg|opus|flac|webm)$/i.test(file.name)) throw new Error('Choose a supported audio file.') }
export function validateSourceUrl(value) { try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); return url.toString() } catch { throw new Error('Enter a valid HTTP or HTTPS source URL.') } }

export async function queueUpload(file, userId, onProgress) {
  validateAudioFile(file);
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `imports/${userId}/${crypto.randomUUID()}.${extension}`;
  onProgress?.(5);
  const { error: uploadError } = await supabase.storage.from('soundverse').upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (uploadError) throw new Error(`Staging upload failed: ${uploadError.message}`);
  onProgress?.(45);
  
  return createImportJob({
    source_type: 'upload',
    source_url: `storage://soundverse/${path}`,
    metadata: { title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') }
  });
}

export const queueUrl = async (source_url, source_type) => {
  return createImportJob({ source_type, source_url: validateSourceUrl(source_url), metadata: {} });
}

async function createImportJob(payload) {
  // Validate the browser session before invoking the function. The function
  // independently validates the Authorization bearer token server-side.
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error('Your session is invalid. Please sign in again.');
  const user = authData?.user;
  if (!user?.id) throw new Error('Sign in is required to create an import job.');

  // `import-job` is authoritative: it checks the bearer token, role, staged
  // upload ownership, and blocks private-network URL targets. Do not fall
  // back to a client table insert, which would bypass those checks.
  const { data, error } = await supabase.functions.invoke('import-job', { body: payload });
  if (!error) {
    if (data?.error) throw new Error(data.error);
    if (data?.job) return { job: data.job };
    throw new Error('The import service returned an invalid response.');
  }

  throw new Error(error?.message || 'The import service is unavailable.');
}

export const importAction = async (action, job) => {
  const { data, error } = await supabase.functions.invoke('import-job', { body: { action, id: job.id, retry_count: job.retry_count || 0 } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}
