package core

import (
	"bytes"
	"testing"
)

func TestMemoReturnFullRange(t *testing.T) {
	for n := 0; n <= 32; n++ {
		payload := make([]byte, n)
		for i := 0; i < n; i++ {
			payload[i] = byte(i)
		}

		memo, err := MemoReturn(payload)
		if err != nil {
			t.Fatalf("MemoReturn(%d bytes) returned error: %v", n, err)
		}

		if memo.Type != MemoTypeReturn {
			t.Fatalf("MemoReturn(%d bytes) type = %v, want %v", n, memo.Type, MemoTypeReturn)
		}

		if memo.Return == nil {
			t.Fatalf("MemoReturn(%d bytes) Return is nil", n)
		}

		if !bytes.Equal(memo.Return[:n], payload) {
			t.Fatalf("MemoReturn(%d bytes) payload mismatch: got %v, want %v", n, memo.Return[:n], payload)
		}

		for i := n; i < len(memo.Return); i++ {
			if memo.Return[i] != 0 {
				t.Fatalf("MemoReturn(%d bytes) trailing byte %d = %d, want 0", n, i, memo.Return[i])
			}
		}
	}
}

func TestMemoReturnTooLong(t *testing.T) {
	payload := make([]byte, 33)
	if _, err := MemoReturn(payload); err == nil {
		t.Fatal("MemoReturn(33 bytes) expected error, got nil")
	}
}
