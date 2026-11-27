import type { DiagnosticLogger } from "./logger";

export interface RouterOptions {
  /**
   * Optional telemetry logger for structured audit trails during deposit
   * reconciliation. Defaults to a no-op logger when omitted.
   */
  logger?: DiagnosticLogger;
}
