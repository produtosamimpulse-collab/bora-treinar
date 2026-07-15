// App pessoal - manter a sessão viva por pouco tempo é mais importante do
// que evitar login toda vez. 12h cobre um dia de uso (treino de manhã e de
// noite) sem exigir senha de novo no meio, mas expira se o dispositivo
// ficar parado de um dia pro outro.
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60
