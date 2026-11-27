package strkey

import (
	"bytes"
	"testing"
)

func TestEncodeContract(t *testing.T) {
	tests := []struct {
		name    string
		address []byte
		want    string
	}{
		{
			name:    "valid contract key",
			address: bytes.Repeat([]byte{0x00}, 32),
			want:    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := EncodeContract(tt.address)
			if err != nil {
				t.Fatalf("EncodeContract() error = %v", err)
			}
			if got != tt.want {
				t.Errorf("EncodeContract() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestDecodeContract(t *testing.T) {
	tests := []struct {
		name    string
		address string
		want    []byte
		wantErr bool
	}{
		{
			name:    "valid contract key",
			address: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
			want:    bytes.Repeat([]byte{0x00}, 32),
		},
		{
			name:    "corrupted checksum",
			address: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KN",
			wantErr: true,
		},
		{
			name:    "wrong version byte",
			address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
			wantErr: true,
		},
		{
			name:    "invalid length",
			address: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := DecodeContract(tt.address)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("DecodeContract() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("DecodeContract() error = %v", err)
			}
			if !bytes.Equal(got, tt.want) {
				t.Errorf("DecodeContract() = %x, want %x", got, tt.want)
			}
		})
	}
}
