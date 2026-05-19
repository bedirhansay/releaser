export class GitProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GitProviderError";
  }
}

export class GitAuthError extends GitProviderError {
  constructor(message = "Git provider authentication failed") {
    super(message, undefined, 401);
    this.name = "GitAuthError";
  }
}

export class GitNotFoundError extends GitProviderError {
  constructor(message = "Resource not found") {
    super(message, undefined, 404);
    this.name = "GitNotFoundError";
  }
}
