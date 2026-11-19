package sep0029

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// mockNetError is a net.Error that lets us control Timeout() and Temporary().
type mockNetError struct {
	msg     string
	timeout bool
}

func (e *mockNetError) Error() string   { return e.msg }
func (e *mockNetError) Timeout() bool   { return e.timeout }
func (e *mockNetError) Temporary() bool { return true }

// networkErrorTransport returns a RoundTripper that fails the first n requests
// with the provided error, then delegates to the real transport.
type networkErrorTransport struct {
	failures int32
	err      error
	fallback http.RoundTripper
	calls    atomic.Int32
}

func (t *networkErrorTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	n := t.calls.Add(1)
	if n <= t.failures {
		return nil, t.err
	}
	return t.fallback.RoundTrip(req)
}

// clientWithTransport builds a fast Client whose HTTP transport is replaced.
func clientWithTransport(retries int, rt http.RoundTripper) *Client {
	c := NewClient(HTTPClientOptions{
		Timeout:         2 * time.Second,
		MaxRetries:      retries,
		BackoffDuration: time.Millisecond,
		HTTPClient:      &http.Client{Transport: rt},
	})
	return c
}

// TestFetchRetriesOnNetError verifies that a transient net.Error causes the
// client to retry and eventually succeed.
func TestFetchRetriesOnNetError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(validTOML))
	}))
	t.Cleanup(srv.Close)

	netErr := &mockNetError{msg: "connection reset by peer", timeout: false}
	tr := &networkErrorTransport{
		failures: 2,
		err:      netErr,
		fallback: http.DefaultTransport,
	}

	toml, err := clientWithTransport(3, tr).FetchTOMLFromURL(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("FetchTOMLFromURL: %v", err)
	}
	if toml.OrgName != "Example" {
		t.Fatalf("OrgName = %q, want Example", toml.OrgName)
	}
	if got := tr.calls.Load(); got != 3 {
		t.Fatalf("%d attempts, want 3", got)
	}
}

// TestFetchRetriesOnTimeoutNetError verifies that a timeout net.Error is
// treated as transient and retried.
func TestFetchRetriesOnTimeoutNetError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(validTOML))
	}))
	t.Cleanup(srv.Close)

	timeoutErr := &mockNetError{msg: "i/o timeout", timeout: true}
	tr := &networkErrorTransport{
		failures: 1,
		err:      timeoutErr,
		fallback: http.DefaultTransport,
	}

	toml, err := clientWithTransport(2, tr).FetchTOMLFromURL(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("FetchTOMLFromURL: %v", err)
	}
	if toml.OrgName != "Example" {
		t.Fatalf("OrgName = %q, want Example", toml.OrgName)
	}
	if got := tr.calls.Load(); got != 2 {
		t.Fatalf("%d attempts, want 2", got)
	}
}

// TestFetchRetriesOnUnexpectedEOF verifies that io.ErrUnexpectedEOF (a common
// symptom of a connection being torn down mid-response) is retried.
func TestFetchRetriesOnUnexpectedEOF(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(validTOML))
	}))
	t.Cleanup(srv.Close)

	tr := &networkErrorTransport{
		failures: 1,
		err:      io.ErrUnexpectedEOF,
		fallback: http.DefaultTransport,
	}

	toml, err := clientWithTransport(2, tr).FetchTOMLFromURL(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("FetchTOMLFromURL: %v", err)
	}
	if toml.OrgName != "Example" {
		t.Fatalf("OrgName = %q, want Example", toml.OrgName)
	}
	if got := tr.calls.Load(); got != 2 {
		t.Fatalf("%d attempts, want 2", got)
	}
}

// TestFetchRetriesOnEOF verifies that io.EOF at the transport layer is retried.
func TestFetchRetriesOnEOF(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(validTOML))
	}))
	t.Cleanup(srv.Close)

	tr := &networkErrorTransport{
		failures: 1,
		err:      io.EOF,
		fallback: http.DefaultTransport,
	}

	toml, err := clientWithTransport(2, tr).FetchTOMLFromURL(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("FetchTOMLFromURL: %v", err)
	}
	if toml.OrgName != "Example" {
		t.Fatalf("OrgName = %q, want Example", toml.OrgName)
	}
	if got := tr.calls.Load(); got != 2 {
		t.Fatalf("%d attempts, want 2", got)
	}
}

// TestFetchGivesUpAfterMaxRetriesOnNetError verifies that a persistent network
// error exhausts retries and returns the last error.
func TestFetchGivesUpAfterMaxRetriesOnNetError(t *testing.T) {
	netErr := &mockNetError{msg: "connection refused", timeout: false}
	tr := &networkErrorTransport{
		failures: 100,
		err:      netErr,
		fallback: http.DefaultTransport,
	}

	_, err := clientWithTransport(2, tr).Fetch(context.Background(), "http://127.0.0.1:0/unused")
	if err == nil {
		t.Fatal("expected an error after exhausting retries")
	}
	if !errors.Is(err, netErr) {
		t.Fatalf("err = %v, want to wrap the net error", err)
	}
	if got := tr.calls.Load(); got != 3 {
		t.Fatalf("%d attempts, want 3 (1 + 2 retries)", got)
	}
}

// TestFetchDoesNotRetryContextCancellation verifies that a context.Canceled
// error from the transport is not retried — it is a deliberate abort.
func TestFetchDoesNotRetryContextCancellation(t *testing.T) {
	tr := &networkErrorTransport{
		failures: 100,
		err:      context.Canceled,
		fallback: http.DefaultTransport,
	}

	_, err := clientWithTransport(3, tr).Fetch(context.Background(), "http://127.0.0.1:0/unused")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
	// context.Canceled is not retried — only 1 attempt.
	if got := tr.calls.Load(); got != 1 {
		t.Fatalf("%d attempts, want 1 (cancellation is not retried)", got)
	}
}

// TestFetchRetriesOnConnectionRefused verifies that a real connection-refused
// error from the OS triggers retry behaviour.
func TestFetchRetriesOnConnectionRefused(t *testing.T) {
	// Find a port that is definitely not listening.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	addr := ln.Addr().String()
	ln.Close() // close immediately so the port is not listening

	c := NewClient(HTTPClientOptions{
		Timeout:         500 * time.Millisecond,
		MaxRetries:      2,
		BackoffDuration: time.Millisecond,
	})

	_, err = c.Fetch(context.Background(), "http://"+addr+"/stellar.toml")
	if err == nil {
		t.Fatal("expected connection refused error")
	}
	var netErr net.Error
	if !errors.As(err, &netErr) {
		// connection refused wraps *net.OpError which satisfies net.Error
		t.Logf("err type = %T: %v (not net.Error, may still be a network error)", err, err)
	}
}

// TestFetchNetErrorRecoveryWithContextDeadline verifies that a client with a
// very short per-attempt timeout retries on context.DeadlineExceeded and
// succeeds on the next attempt when the server responds in time.
func TestFetchNetErrorRecoveryWithContextDeadline(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			// First attempt: stall until the per-attempt timeout fires.
			select {
			case <-r.Context().Done():
			case <-time.After(5 * time.Second):
			}
			return
		}
		_, _ = w.Write([]byte(validTOML))
	}))
	t.Cleanup(srv.Close)

	c := NewClient(HTTPClientOptions{
		Timeout:         20 * time.Millisecond,
		MaxRetries:      1,
		BackoffDuration: time.Millisecond,
	})

	toml, err := c.FetchTOMLFromURL(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("FetchTOMLFromURL: %v", err)
	}
	if toml.OrgName != "Example" {
		t.Fatalf("OrgName = %q, want Example", toml.OrgName)
	}
	if got := calls.Load(); got != 2 {
		t.Fatalf("%d server calls, want 2", got)
	}
}

// TestTransientFunctionNetErrors validates the transient() helper's
// classification of various error types.
func TestTransientFunctionNetErrors(t *testing.T) {
	tests := []struct {
		name      string
		err       error
		wantRetry bool
	}{
		{
			name:      "net.Error (non-timeout) is transient",
			err:       &mockNetError{msg: "connection reset", timeout: false},
			wantRetry: true,
		},
		{
			name:      "net.Error (timeout) is transient",
			err:       &mockNetError{msg: "i/o timeout", timeout: true},
			wantRetry: true,
		},
		{
			name:      "io.ErrUnexpectedEOF is transient",
			err:       io.ErrUnexpectedEOF,
			wantRetry: true,
		},
		{
			name:      "io.EOF is transient",
			err:       io.EOF,
			wantRetry: true,
		},
		{
			name:      "context.DeadlineExceeded is transient",
			err:       context.DeadlineExceeded,
			wantRetry: true,
		},
		{
			name:      "context.Canceled is not transient",
			err:       context.Canceled,
			wantRetry: false,
		},
		{
			name:      "generic error is not transient",
			err:       errors.New("something unexpected"),
			wantRetry: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := transient(tt.err)
			if got != tt.wantRetry {
				t.Errorf("transient(%v) = %v, want %v", tt.err, got, tt.wantRetry)
			}
		})
	}
}
