const ACCESS_TOKEN_COOKIE = "edu_access_token";
const COOKIE_PATH = "; Path=/; SameSite=Lax";

export function setAccessTokenCookie(token: string) {
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}${COOKIE_PATH}`;
}

export function clearAccessTokenCookie() {
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; Max-Age=0${COOKIE_PATH}`;
}
