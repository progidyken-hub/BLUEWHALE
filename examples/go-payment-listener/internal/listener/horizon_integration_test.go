package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/protocols/horizon/operations"
)

// These tests verify the "live payment ingest" path against a mocked Stellar
// Horizon server. The mock speaks the same Server-Sent Events protocol that
// the real Horizon `/operations` stream uses, so the production
// horizonclient.StreamOperations code path runs unmodified — only the server
// at the other end of the HTTP connection is faked.

const (
	horizonTestBaseG = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI"
	horizonTestMuxed = "MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACABAAAAAAAAAAEVIG"
)

// paymentJSON builds the JSON body of a Horizon Payment operation event,
// including the embedded transaction (memo_type/memo) that the listener reads.
func paymentJSON(to, memoType, memo string) string {
	type tx struct {
		MemoType string `json:"memo_type"`
		Memo     string `json:"memo,omitempty"`
	}
	type p struct {
		Type            string `json:"type"`
		TypeI           int32  `json:"type_i"`
		ID              string `json:"id"`
		PagingToken     string `json:"paging_token"`
		TransactionHash string `json:"transaction_hash"`
		SourceAccount   string `json:"source_account"`
		To              string `json:"to"`
		From            string `json:"from"`
		AssetType       string `json:"asset_type"`
		Amount          string `json:"amount"`
		Transaction     tx     `json:"transaction"`
	}
	raw, _ := json.Marshal(p{
		Type:            "payment",
		TypeI:           1, // xdr.OperationTypePayment
		ID:              "123",
		PagingToken:     "123",
		TransactionHash: "aabbcc",
		SourceAccount:   "GABC",
		To:              to,
		From:            "GABC",
		AssetType:       "native",
		Amount:          "100.0000000",
		Transaction:     tx{MemoType: memoType, Memo: memo},
	})
	return string(raw)
}

// mockHorizonServer returns an httptest server that emits the given SSE event
// payloads (raw JSON strings) for a single `/operations` request, then closes
// the response body. The stellar/go client reconnects after EOF, so callers
// must cancel the stream context once they have received the events they want.
func mockHorizonServer(payloads []string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}
		for _, body := range payloads {
			fmt.Fprintf(w, "data: %s\n\n", body)
			flusher.Flush()
		}
		// Returning closes the response body; the client reads the events then
		// hits EOF.
	}))
}

// streamPayments drives the real horizonclient.StreamOperations against the
// mock server, collecting every Payment operation until either `want` payments
// have arrived or the context expires. It returns the collected payments.
func streamPayments(t *testing.T, url string, want int) []operations.Payment {
	t.Helper()
	client := &horizonclient.Client{HorizonURL: url}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var (
		mu       sync.Mutex
		received []operations.Payment
	)
	_ = client.StreamOperations(ctx, horizonclient.OperationRequest{}, func(op operations.Operation) {
		p, ok := op.(operations.Payment)
		if !ok {
			return
		}
		mu.Lock()
		received = append(received, p)
		got := len(received)
		mu.Unlock()
		if got == want {
			cancel() // we have what we came for; stop the stream
		}
	})
	return received
}

// TestHorizonIntegration_GAddressWithMemoID verifies a G-address payment that
// carries a MEMO_ID resolves to routing source "memo" with info severity.
func TestHorizonIntegration_GAddressWithMemoID(t *testing.T) {
	srv := mockHorizonServer([]string{paymentJSON(horizonTestBaseG, "id", "42")})
	defer srv.Close()

	payments := streamPayments(t, srv.URL, 1)
	if len(payments) != 1 {
		t.Fatalf("received %d payments, want 1", len(payments))
	}
	result := ExtractRouting(payments[0])

	if result.DestinationBaseAccount != horizonTestBaseG {
		t.Errorf("DestinationBaseAccount = %q, want %q", result.DestinationBaseAccount, horizonTestBaseG)
	}
	if result.RoutingSource != "memo" {
		t.Errorf("RoutingSource = %q, want %q", result.RoutingSource, "memo")
	}
	if result.RoutingID == nil || result.RoutingID.String() != "42" {
		t.Errorf("RoutingID = %v, want 42", result.RoutingID)
	}
	if sev := MapResultToSeverity(result); sev != SeverityInfo {
		t.Errorf("severity = %q, want %q", sev, SeverityInfo)
	}
}

// TestHorizonIntegration_MuxedAddress verifies an M-address payment with no memo
// resolves to routing source "muxed" (the routing ID lives inside the address).
func TestHorizonIntegration_MuxedAddress(t *testing.T) {
	srv := mockHorizonServer([]string{paymentJSON(horizonTestMuxed, "none", "")})
	defer srv.Close()

	payments := streamPayments(t, srv.URL, 1)
	if len(payments) != 1 {
		t.Fatalf("received %d payments, want 1", len(payments))
	}
	result := ExtractRouting(payments[0])

	if result.DestinationBaseAccount != horizonTestBaseG {
		t.Errorf("DestinationBaseAccount = %q, want %q", result.DestinationBaseAccount, horizonTestBaseG)
	}
	if result.RoutingSource != "muxed" {
		t.Errorf("RoutingSource = %q, want %q", result.RoutingSource, "muxed")
	}
	if result.RoutingID == nil {
		t.Error("RoutingID is nil, want a non-nil muxed routing ID")
	}
	if sev := MapResultToSeverity(result); sev != SeverityInfo {
		t.Errorf("severity = %q, want %q", sev, SeverityInfo)
	}
}

// TestHorizonIntegration_GAddressNoMemoIsUnroutable verifies that a G-address
// payment with no memo is classified as unroutable (error severity), since no
// routing ID can be recovered.
func TestHorizonIntegration_GAddressNoMemoIsUnroutable(t *testing.T) {
	srv := mockHorizonServer([]string{paymentJSON(horizonTestBaseG, "none", "")})
	defer srv.Close()

	payments := streamPayments(t, srv.URL, 1)
	if len(payments) != 1 {
		t.Fatalf("received %d payments, want 1", len(payments))
	}
	result := ExtractRouting(payments[0])

	if result.RoutingSource != "none" {
		t.Errorf("RoutingSource = %q, want %q", result.RoutingSource, "none")
	}
	if sev := MapResultToSeverity(result); sev != SeverityError {
		t.Errorf("severity = %q, want %q", sev, SeverityError)
	}
}

// TestHorizonIntegration_MultiplePaymentsInOneBatch verifies that every payment
// in a single SSE response is ingested and routed correctly.
func TestHorizonIntegration_MultiplePaymentsInOneBatch(t *testing.T) {
	payloads := []string{
		paymentJSON(horizonTestBaseG, "id", "1"),
		paymentJSON(horizonTestBaseG, "id", "2"),
		paymentJSON(horizonTestMuxed, "none", ""),
	}
	srv := mockHorizonServer(payloads)
	defer srv.Close()

	payments := streamPayments(t, srv.URL, len(payloads))
	if len(payments) != len(payloads) {
		t.Fatalf("received %d payments, want %d", len(payments), len(payloads))
	}

	wantSources := []string{"memo", "memo", "muxed"}
	wantIDs := []string{"1", "2", ""} // muxed ID is non-nil but varies; check source only
	for i, p := range payments {
		result := ExtractRouting(p)
		if result.RoutingSource != wantSources[i] {
			t.Errorf("payment[%d] RoutingSource = %q, want %q", i, result.RoutingSource, wantSources[i])
		}
		if i < 2 {
			if result.RoutingID == nil || result.RoutingID.String() != wantIDs[i] {
				t.Errorf("payment[%d] RoutingID = %v, want %s", i, result.RoutingID, wantIDs[i])
			}
		}
	}
}

// TestHorizonIntegration_ServerErrorFailsStream verifies that a non-2xx
// response from Horizon causes StreamOperations to return an error rather than
// silently retrying forever.
func TestHorizonIntegration_ServerErrorFailsStream(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	client := &horizonclient.Client{HorizonURL: srv.URL}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := client.StreamOperations(ctx, horizonclient.OperationRequest{}, func(operations.Operation) {})
	if err == nil {
		t.Error("expected StreamOperations to return an error for a 503 response, got nil")
	}
}
