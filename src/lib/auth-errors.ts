// Maps Supabase Auth errors (status 400/422) to pt-BR user-facing messages.
export type AuthErrorLike = { message?: string; code?: string; status?: number };

export function mapSignInError(error: AuthErrorLike): string {
  const msg = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();
  if (
    code === "email_not_confirmed" ||
    msg.includes("not confirmed") ||
    msg.includes("email not confirmed")
  ) {
    return "Email não confirmado. Verifique sua caixa de entrada para ativar a conta.";
  }
  if (code === "invalid_credentials" || msg.includes("invalid login") || msg.includes("invalid")) {
    return "Email ou senha incorretos";
  }
  if (msg.includes("rate") || msg.includes("too many")) {
    return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
  }
  return error.message ?? "Erro ao entrar";
}

export function mapSignUpError(error: AuthErrorLike): string {
  const msg = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();
  if (
    code.includes("already") ||
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("user already")
  ) {
    return "Este email já está cadastrado. Faça login.";
  }
  if (
    code === "weak_password" ||
    msg.includes("weak") ||
    msg.includes("password should") ||
    msg.includes("password is too")
  ) {
    return "Senha muito fraca. Use pelo menos 6 caracteres, combinando letras e números.";
  }
  if (
    code === "validation_failed" ||
    msg.includes("invalid email") ||
    msg.includes("email address")
  ) {
    return "Email inválido. Verifique o endereço informado.";
  }
  if (msg.includes("signup") && msg.includes("disabled")) {
    return "Cadastro desabilitado no momento. Contate o administrador.";
  }
  if (msg.includes("rate") || msg.includes("too many")) {
    return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
  }
  return error.message ?? "Erro ao criar conta";
}
