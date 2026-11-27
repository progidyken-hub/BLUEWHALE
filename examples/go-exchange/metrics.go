package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// DepositStatus is the routing outcome recorded for a deposit.
type DepositStatus string

const (
	DepositStatusValid       DepositStatus = "valid"
	DepositStatusInvalid     DepositStatus = "invalid"
	DepositStatusQuarantined DepositStatus = "quarantined"
)

// MetricsCollector records deposit routing outcomes.
type MetricsCollector interface {
	RecordDeposit(depositType string, status DepositStatus)
}

// PrometheusMetricsCollector is the default MetricsCollector implementation.
// It exposes bluewhale_deposits_total{type, status}.
type PrometheusMetricsCollector struct {
	deposits *prometheus.CounterVec
}

// NewPrometheusMetricsCollector builds a collector registered against reg.
func NewPrometheusMetricsCollector(reg prometheus.Registerer) *PrometheusMetricsCollector {
	deposits := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "bluewhale_deposits_total",
		Help: "Total number of deposit routing outcomes by type and status.",
	}, []string{"type", "status"})

	if reg != nil {
		if err := reg.Register(deposits); err != nil {
			if already, ok := err.(prometheus.AlreadyRegisteredError); ok {
				if existing, ok := already.ExistingCollector.(*prometheus.CounterVec); ok {
					deposits = existing
				}
			}
		}
	}

	return &PrometheusMetricsCollector{deposits: deposits}
}

// RecordDeposit increments the counter for the given deposit type and status.
func (c *PrometheusMetricsCollector) RecordDeposit(depositType string, status DepositStatus) {
	if c == nil || c.deposits == nil {
		return
	}
	c.deposits.WithLabelValues(depositType, string(status)).Inc()
}

// noopMetricsCollector is used when metrics are disabled.
type noopMetricsCollector struct{}

func (noopMetricsCollector) RecordDeposit(string, DepositStatus) {}

// NewMetricsCollector returns a Prometheus collector when enabled, otherwise a no-op.
func NewMetricsCollector(enabled bool, reg prometheus.Registerer) MetricsCollector {
	if !enabled {
		return noopMetricsCollector{}
	}
	return NewPrometheusMetricsCollector(reg)
}

// metricsHandler serves the Prometheus scrape endpoint.
func metricsHandler(reg *prometheus.Registry) http.Handler {
	return promhttp.HandlerFor(reg, promhttp.HandlerOpts{})
}

// grafanaDashboard is an example Grafana dashboard for deposit routing metrics.
// It is served from /metrics/dashboard.json for convenience.
func grafanaDashboard() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(exampleGrafanaDashboard))
	}
}

var _ = fmt.Sprintf
var _ = json.Marshal
var _ = sync.Once{}

const exampleGrafanaDashboard = `{
  "title": "Bluewhale Deposit Routing",
  "uid": "bluewhale-deposits",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "30s",
  "panels": [
    {
      "type": "timeseries",
      "title": "Deposits by status",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "targets": [
        {
          "expr": "sum by (status) (rate(bluewhale_deposits_total[5m]))",
          "legendFormat": "{{status}}"
        }
      ]
    },
    {
      "type": "timeseries",
      "title": "Deposits by type",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "targets": [
        {
          "expr": "sum by (type) (rate(bluewhale_deposits_total[5m]))",
          "legendFormat": "{{type}}"
        }
      ]
    },
    {
      "type": "stat",
      "title": "Quarantined deposits (total)",
      "gridPos": { "h": 6, "w": 8, "x": 0, "y": 8 },
      "targets": [
        {
          "expr": "sum(bluewhale_deposits_total{status=\"quarantined\"})"
        }
      ]
    },
    {
      "type": "stat",
      "title": "Invalid deposits (total)",
      "gridPos": { "h": 6, "w": 8, "x": 8, "y": 8 },
      "targets": [
        {
          "expr": "sum(bluewhale_deposits_total{status=\"invalid\"})"
        }
      ]
    },
    {
      "type": "stat",
      "title": "Valid deposits (total)",
      "gridPos": { "h": 6, "w": 8, "x": 16, "y": 8 },
      "targets": [
        {
          "expr": "sum(bluewhale_deposits_total{status=\"valid\"})"
        }
      ]
    }
  ]
}`
