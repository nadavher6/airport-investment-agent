import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ApiErrorBody, ApiErrorCode } from "@airport/shared";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  model_unavailable: 503,
  internal: 500,
};

/** Throw from any route; the error middleware turns it into an ApiErrorBody. */
export class HttpError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

export function errorBody(code: ApiErrorCode, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(errorBody("not_found", `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json(errorBody(err.code, err.message));
    return;
  }
  // express.json() throws a SyntaxError carrying status 400 on malformed bodies.
  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    res.status(400).json(errorBody("bad_request", "Request body is not valid JSON"));
    return;
  }
  console.error(err);
  res.status(500).json(errorBody("internal", "Unexpected server error"));
};
