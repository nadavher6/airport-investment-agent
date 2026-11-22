import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ApiErrorBody, ApiErrorCode } from "@airport/shared";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  payload_too_large: 413,
  model_unavailable: 503,
  too_many_requests: 429,
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

/**
 * express.json() (body-parser) rejects bad bodies with errors that carry a 4xx
 * `status` and a `type` like "entity.too.large" or "charset.unsupported".
 */
interface ClientError extends Error {
  readonly status: number;
  readonly type?: unknown;
}

function isClientError(err: unknown): err is ClientError {
  if (!(err instanceof Error) || !("status" in err)) return false;
  return typeof err.status === "number" && err.status >= 400 && err.status < 500;
}

function clientErrorBody(err: ClientError): ApiErrorBody {
  if (err.status === 413) return errorBody("payload_too_large", "Request body is too large");
  if (err.type === "entity.parse.failed") return errorBody("bad_request", "Request body is not valid JSON");
  return errorBody("bad_request", err.message);
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  // Once a stream has started we can't send a JSON body; Express's default handler closes the socket.
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json(errorBody(err.code, err.message));
    return;
  }
  if (isClientError(err)) {
    res.status(err.status).json(clientErrorBody(err));
    return;
  }
  console.error(err);
  res.status(500).json(errorBody("internal", "Unexpected server error"));
};
