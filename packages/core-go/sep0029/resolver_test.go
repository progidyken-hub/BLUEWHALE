package sep0029

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestResolveSep29_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/toml")
		_, _ = w.Write([]byte("TRANSFER_SERVER_SEP0029 = \"https://example.com/sep29\"\n"))
	}))
	defer srv.Close()

	ctx := context.Background()
	res, err := ResolveSep29(ctx, srv.URL)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res == nil {
		t.Fatal("expected non-nil result")
	}
}

func TestResolveSep29_ContextCancellation(t *testing.T) {
	block := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-block:
		case <-r.Context().Done():
		}
	}))
	defer srv.Close()
	defer close(block)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	start := time.Now()
	_, err := ResolveSep29(ctx, srv.URL)
	if err == nil {
		t.Fatal("expected error on cancelled context")
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Fatalf("cancellation took too long: %v", elapsed)
	}
}

func TestResolveSep29_DeadlineExceeded(t *testing.T) {
	block := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-block:
		case <-r.Context().Done():
		}
	}))
	defer srv.Close()
	defer close(block)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	_, err := ResolveSep29(ctx, srv.URL)
	if err == nil {
		t.Fatal("expected error on deadline exceeded")
	}
}

func TestResolveSep29_BodyLimit(t *testing.T) {
	big := strings.Repeat("A", 200*1024)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/toml")
		_, _ = w.Write([]byte(big))
	}))
	defer srv.Close()

	ctx := context.Background()
	_, err := ResolveSep29(ctx, srv.URL)
	if err == nil {
		t.Fatal("expected error when response body exceeds limit")
	}
}
