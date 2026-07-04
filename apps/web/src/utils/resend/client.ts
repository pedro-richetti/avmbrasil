import { Resend } from 'resend';

// Provide a dummy fallback so the Next.js build doesn't crash during prerendering
export const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
