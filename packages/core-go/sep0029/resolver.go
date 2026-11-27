package sep0029

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	// DefaultHTTPTimeout is the default deadline applied to SEP-0029 HTTP requests.
	DefaultHTTPTimeout = 5 * time.Second

	// MaxResponseBodySize caps how many bytes are read from a stellar.toml response.
	MaxResponseBodySize = 100 * 1024
)

// ErrResponseTooLarge is returned when a stellar.toml response exceeds MaxResponseBodySize.
var ErrResponseTooLarge = errors.New("sep0029: response body exceeds 100KB limit")

// Resolver resolves SEP-0029 stellar.toml metadata for a Stellar account.
type Resolver struct {
	client  *http.Client
	timeout time.Duration
}

// NewResolver creates a Resolver with the default 5-second HTTP timeout.
func NewResolver() *Resolver {
	return &Resolver{
		client:  &http.Client{Timeout: DefaultHTTPTimeout},
		timeout: DefaultHTTPTimeout,
	}
}

// NewResolverWithTimeout creates a Resolver with a configurable HTTP timeout.
func NewResolverWithTimeout(timeout time.Duration) *Resolver {
	if timeout <= 0 {
		timeout = DefaultHTTPTimeout
	}
	return &Resolver{
		client:  &http.Client{Timeout: timeout},
		timeout: timeout,
	}
}

// ResolveSep29 fetches and decodes the stellar.toml for the given domain.
// The provided context controls cancellation and deadline of the request.
func (r *Resolver) ResolveSep29(ctx context.Context, domain string) (*StellarToml, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	url := fmt.Sprintf("https://%s/.well-known/stellar.toml", domain)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("sep0029: build request: %w", err)
	}

	client := r.client
	if client == nil {
		client = &http.Client{Timeout: DefaultHTTPTimeout}
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sep0029: fetch stellar.toml: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sep0029: unexpected status %d", resp.StatusCode)
	}

	limited := io.LimitReader(resp.Body, MaxResponseBodySize+1)
	body, err := io.ReadAll(limited)
	if err != nil {
		return nil, fmt.Errorf("sep0029: read stellar.toml: %w", err)
	}
	if len(body) > MaxResponseBodySize {
		return nil, ErrResponseTooLarge
	}

	var toml StellarToml
	if err := json.Unmarshal(body, &toml); err != nil {
		return nil, fmt.Errorf("sep0029: decode stellar.toml: %w", err)
	}

	return &toml, nil
}

// StellarToml holds the subset of SEP-0029 metadata consumed by the resolver.
type StellarToml struct {
	Version           int               `json:"VERSION"`
	NetworkPassphrase string            `json:"NETWORK_PASSPHRASE"`
	Accounts          []string          `json:"ACCOUNTS"`
	SigningKey        string            `json:"SIGNING_KEY"`
	Documentation     map[string]string `json:"DOCUMENTATION"`
}
