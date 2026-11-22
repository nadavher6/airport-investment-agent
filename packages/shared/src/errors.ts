export type ApiErrorCode =
  | "bad_request"
  | "not_found"
  | "payload_too_large"
  | "model_unavailable"
  | "internal";

export interface ApiError {
  readonly code: ApiErrorCode;
  readonly message: string;
}

/** Body of every non-2xx JSON response. */
export interface ApiErrorBody {
  readonly error: ApiError;
}
