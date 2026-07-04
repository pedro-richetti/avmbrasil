export default function PendingApprovalPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '28rem', borderRadius: '0.5rem', backgroundColor: 'var(--panel)', padding: '2rem', textAlign: 'center', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--ink)' }}>Acesso Pendente</h2>
        <p style={{ marginTop: '1rem', fontSize: '1rem', color: 'var(--muted)', lineHeight: '1.5' }}>
          Seu cadastro foi realizado com sucesso, mas o seu acesso ainda precisa ser aprovado por um administrador.
        </p>
        <p style={{ marginTop: '1rem', fontSize: '1rem', color: 'var(--muted)', lineHeight: '1.5' }}>
          Você receberá um e-mail assim que o acesso for liberado.
        </p>
        <div style={{ marginTop: '2rem' }}>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn primary">
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
