import { describe, it, expect } from "vitest";
import { mapSignInError, mapSignUpError } from "./auth-errors";

describe("mapSignInError (status 400)", () => {
  it("email não confirmado (code)", () => {
    expect(mapSignInError({ status: 400, code: "email_not_confirmed", message: "Email not confirmed" }))
      .toBe("Email não confirmado. Verifique sua caixa de entrada para ativar a conta.");
  });
  it("email não confirmado (message fallback)", () => {
    expect(mapSignInError({ status: 400, message: "Email not confirmed" }))
      .toBe("Email não confirmado. Verifique sua caixa de entrada para ativar a conta.");
  });
  it("credenciais inválidas (code)", () => {
    expect(mapSignInError({ status: 400, code: "invalid_credentials", message: "Invalid login credentials" }))
      .toBe("Email ou senha incorretos");
  });
  it("credenciais inválidas (message)", () => {
    expect(mapSignInError({ status: 400, message: "Invalid login credentials" }))
      .toBe("Email ou senha incorretos");
  });
  it("rate limit", () => {
    expect(mapSignInError({ status: 429, message: "Too many requests" }))
      .toBe("Muitas tentativas. Aguarde alguns instantes e tente novamente.");
  });
  it("fallback para message original", () => {
    expect(mapSignInError({ message: "Some other error" })).toBe("Some other error");
  });
});

describe("mapSignUpError (status 422)", () => {
  it("email já cadastrado (message)", () => {
    expect(mapSignUpError({ status: 422, message: "User already registered" }))
      .toBe("Este email já está cadastrado. Faça login.");
  });
  it("email já cadastrado (code)", () => {
    expect(mapSignUpError({ status: 422, code: "user_already_exists", message: "x" }))
      .toBe("Este email já está cadastrado. Faça login.");
  });
  it("senha fraca (code)", () => {
    expect(mapSignUpError({ status: 422, code: "weak_password", message: "Password is too weak" }))
      .toBe("Senha muito fraca. Use pelo menos 6 caracteres, combinando letras e números.");
  });
  it("senha fraca (message)", () => {
    expect(mapSignUpError({ status: 422, message: "Password should be at least 6 characters" }))
      .toBe("Senha muito fraca. Use pelo menos 6 caracteres, combinando letras e números.");
  });
  it("email inválido", () => {
    expect(mapSignUpError({ status: 422, code: "validation_failed", message: "Unable to validate email address" }))
      .toBe("Email inválido. Verifique o endereço informado.");
  });
  it("cadastro desabilitado", () => {
    expect(mapSignUpError({ status: 422, message: "Signup is disabled" }))
      .toBe("Cadastro desabilitado no momento. Contate o administrador.");
  });
  it("rate limit", () => {
    expect(mapSignUpError({ status: 429, message: "Too many requests" }))
      .toBe("Muitas tentativas. Aguarde alguns instantes e tente novamente.");
  });
  it("fallback para message original", () => {
    expect(mapSignUpError({ message: "Unexpected failure" })).toBe("Unexpected failure");
  });
});
