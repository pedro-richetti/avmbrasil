import { NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server'
import { resend } from '@/utils/resend/client'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check if user is newly registered (first time login)
      // We can use the created_at vs last_sign_in_at to infer if this is a fresh signup
      // But a more robust way is to just send an email if their profile has is_approved = false
      // To avoid spam, we should probably record that we sent the email, or just rely on the trigger
      // Let's add a small check: if they just signed up, their last_sign_in_at will be null or very close to created_at
      const user = data.user;
      if (user) {
        const isNewUser = new Date(user.created_at).getTime() > Date.now() - 60000; // created within last minute
        if (isNewUser) {
           // Direct backend invocation - secure and non-exposed
           resend.emails.send({
             from: 'AVM Brasil <onboarding@resend.dev>',
             to: ['pedrohr@gmail.com'],
             subject: 'Novo usuário aguardando aprovação - AVM Brasil',
             html: `<p>O usuário <strong>${user.email}</strong> acabou de se cadastrar no AVM Brasil e está aguardando aprovação para acessar a aplicação.</p><p>Acesse o painel do Supabase para aprovar o acesso mudando o status is_approved para true na tabela user_profiles.</p>`,
           }).catch(console.error);
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
