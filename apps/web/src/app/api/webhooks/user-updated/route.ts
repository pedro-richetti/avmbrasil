import { NextResponse } from 'next/server';
import { resend } from '@/utils/resend/client';

export async function POST(request: Request) {
  try {
    // Authenticate the webhook request
    const authHeader = request.headers.get('Authorization');
    const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const payload = await request.json();

    // Supabase Webhook payload for UPDATE
    if (payload.type === 'UPDATE' && payload.table === 'user_profiles') {
      const oldRecord = payload.old_record;
      const newRecord = payload.record;

      // Check if is_approved changed from false to true
      if (oldRecord && newRecord && !oldRecord.is_approved && newRecord.is_approved) {

        const { data, error } = await resend.emails.send({
          from: 'AVM Brasil <onboarding@resend.dev>', // Resend standard test domain
          to: [newRecord.email],
          subject: 'Seu acesso ao AVM Brasil foi aprovado!',
          html: `<p>Olá!</p><p>Seu acesso ao AVM Brasil acabou de ser aprovado pelo administrador.</p><p>Você já pode acessar a aplicação e criar seus modelos de avaliação.</p>`,
        });

        if (error) {
          console.error("Error sending approval email:", error);
          return NextResponse.json({ error }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }
    }

    return NextResponse.json({ message: 'Ignored webhook event or no action needed.' });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
