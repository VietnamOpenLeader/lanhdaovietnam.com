import { ContentError } from "../core/errors";

const errorMessages: Record<ContentError["code"], string> = {
  VALIDATION: "The request is invalid.",
  UNAUTHENTICATED: "Authentication is required.",
  FORBIDDEN: "Administrator access is required.",
  NOT_FOUND: "The content was not found.",
  CONFLICT: "The content changed or already exists.",
  TOO_LARGE: "The request body is too large.",
  UPSTREAM: "A dependency is unavailable.",
  INTERNAL: "An unexpected error occurred.",
};

export function toContentError(error: unknown): ContentError {
  return error instanceof ContentError
    ? error
    : new ContentError({ status: 500, code: "INTERNAL" });
}

export function contentErrorResponse(error: unknown): Response {
  const contentError = toContentError(error);
  return Response.json(
    {
      error: {
        code: contentError.code,
        message: errorMessages[contentError.code],
        ...(contentError.fields ? { fields: contentError.fields } : {}),
      },
    },
    { status: contentError.status },
  );
}
