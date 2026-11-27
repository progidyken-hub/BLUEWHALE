package core

import (
	"context"
	"log/slog"
)

// MemoRedactor decides whether a memo value should be masked before it is
// emitted as a structured log attribute. Returning true masks the value.
type MemoRedactor func(memoType string, memoVal string) bool

// LoggerOption configures the structured slog handler used by the Router.
type LoggerOption func(*loggerConfig)

type loggerConfig struct {
	logger   *slog.Logger
	redactor MemoRedactor
}

// WithLogger attaches a structured slog logger to the Router. Routing events
// are emitted with the attributes address_type, subaccount_id, memo_type and
// memo_val.
func WithLogger(logger *slog.Logger) LoggerOption {
	return func(c *loggerConfig) {
		c.logger = logger
	}
}

// WithMemoRedactor installs a redaction filter applied to memo attributes
// before they are logged. When the filter reports a memo as sensitive, the
// memo_val attribute is replaced with a masked placeholder.
func WithMemoRedactor(redactor MemoRedactor) LoggerOption {
	return func(c *loggerConfig) {
		c.redactor = redactor
	}
}

const maskedMemoVal = "[REDACTED]"

// logRouting emits a structured routing event. It is a no-op when no logger
// has been configured.
func (c *loggerConfig) logRouting(ctx context.Context, addressType, subaccountID, memoType, memoVal string) {
	if c == nil || c.logger == nil {
		return
	}

	if c.redactor != nil && c.redactor(memoType, memoVal) {
		memoVal = maskedMemoVal
	}

	c.logger.LogAttrs(ctx, slog.LevelInfo, "routing",
		slog.String("address_type", addressType),
		slog.String("subaccount_id", subaccountID),
		slog.String("memo_type", memoType),
		slog.String("memo_val", memoVal),
	)
}
