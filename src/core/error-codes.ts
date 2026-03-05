export const ERROR_CODES = {
  POLICY_DENIED: 'POLICY_DENIED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  SCOPE_VIOLATION: 'SCOPE_VIOLATION',
  INVALID_ARGS: 'INVALID_ARGS',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  SCHEMA_VERSION_UNSUPPORTED: 'SCHEMA_VERSION_UNSUPPORTED',
  ACTION_FAILED: 'ACTION_FAILED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class CliPolicyError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public retryable = false,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CliPolicyError';
  }
}
