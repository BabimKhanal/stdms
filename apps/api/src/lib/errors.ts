/** Every API error thrown by services goes through this class. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
export const unauthorized = (msg = "Authentication required") => new HttpError(401, msg, "unauthenticated");
export const forbidden = (msg = "You do not have permission to do that") => new HttpError(403, msg, "forbidden");
export const notFound = (msg = "Not found") => new HttpError(404, msg, "not_found");
export const conflict = (msg: string) => new HttpError(409, msg, "conflict");
export const tooMany = (msg = "Too many requests") => new HttpError(429, msg, "rate_limited");
