/**
 * Diagnostic logging hooks for the deposit router pipeline.
 *
 * Enterprise integrators can supply a custom {@link DiagnosticLogger} via
 * `RouterOptions.logger` to capture structured audit trails during deposit
 * reconciliation. When no logger is configured, {@link NoopLogger} is used.
 */

export type DiagnosticLogLevel = "debug" | "info" | "warn" | "error";

export interface DiagnosticLogEvent {
  level: DiagnosticLogLevel;
  message: string;
  /** Optional structured context (routing decisions, memo details, etc.). */
  context?: Record<string, unknown>;
}

export interface DiagnosticLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/** Default logger that discards all events. */
export class NoopLogger implements DiagnosticLogger {
  debug(_message: string, _context?: Record<string, unknown>): void {
    // no-op
  }

  info(_message: string, _context?: Record<string, unknown>): void {
    // no-op
  }

  warn(_message: string, _context?: Record<string, unknown>): void {
    // no-op
  }

  error(_message: string, _context?: Record<string, unknown>): void {
    // no-op
  }
}

export const noopLogger: DiagnosticLogger = new NoopLogger();
