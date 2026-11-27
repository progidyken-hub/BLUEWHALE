package core

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

// DepositStatus represents the routing outcome of a deposit operation.
type DepositStatus string

const (
	// DepositStatusValid indicates a deposit that passed validation and was routed.
	DepositStatusValid DepositStatus = "valid"
	// DepositStatusInvalid indicates a deposit that failed validation.
	DepositStatusInvalid DepositStatus = "invalid"
	// DepositStatusQuarantined indicates a deposit held for manual review.
	DepositStatusQuarantined DepositStatus = "quarantined"
)

// MetricsCollector records operational metrics for deposit routing.
type MetricsCollector interface {
	// RecordDeposit increments the deposit counter for the given deposit type
	// and routing status.
	RecordDeposit(depositType string, status DepositStatus)
}

// PrometheusMetricsCollector is the default MetricsCollector implementation
// backed by Prometheus counters.
type PrometheusMetricsCollector struct {
	depositsTotal *prometheus.CounterVec
}

// NewPrometheusMetricsCollector creates a PrometheusMetricsCollector and
// registers its counters with the given registerer. If reg is nil, the
// default Prometheus registerer is used.
func NewPrometheusMetricsCollector(reg prometheus.Registerer) *PrometheusMetricsCollector {
	if reg == nil {
		reg = prometheus.DefaultRegisterer
	}

	c := &PrometheusMetricsCollector{
		depositsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "bluewhale_deposits_total",
				Help: "Total number of deposit routing operations by type and status.",
			},
			[]string{"type", "status"},
		),
	}

	reg.MustRegister(c.depositsTotal)

	return c
}

// RecordDeposit increments the deposit counter for the given deposit type and
// routing status.
func (c *PrometheusMetricsCollector) RecordDeposit(depositType string, status DepositStatus) {
	if c == nil || c.depositsTotal == nil {
		return
	}
	c.depositsTotal.WithLabelValues(depositType, string(status)).Inc()
}

// NoopMetricsCollector is a MetricsCollector that discards all metrics. It is
// useful in tests or when metrics collection is disabled.
type NoopMetricsCollector struct{}

// RecordDeposit implements MetricsCollector and does nothing.
func (NoopMetricsCollector) RecordDeposit(string, DepositStatus) {}

var (
	_ MetricsCollector = (*PrometheusMetricsCollector)(nil)
	_ MetricsCollector = NoopMetricsCollector{}
	_                = sync.Once{}
)
