package strkey

import (
	"testing"
)

// FuzzParseAddress exercises the strkey decoder with arbitrary input to ensure
// it never panics or performs out-of-bounds slices on untrusted ledger data.
func FuzzParseAddress(f *testing.F) {
	// Seed corpus: valid strkey addresses (RFC / SEP-0023 test vectors).
	seeds := []string{
		// Account (G...) from SEP-0023 test vectors.
		"GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
		"GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
		// Muxed account (M...).
		"MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK",
		// Contract (C...).
		"CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA",
		// Empty and short inputs.
		"",
		"G",
		"GA",
	}
	for _, s := range seeds {
		f.Add(s)
	}

	// Seed corpus: corrupted-checksum variants of a valid address.
	valid := "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
	corrupted := []byte(valid)
	if len(corrupted) > 0 {
		// Flip the final checksum character.
		last := corrupted[len(corrupted)-1]
		if last == 'A' {
			corrupted[len(corrupted)-1] = 'B'
		} else {
			corrupted[len(corrupted)-1] = 'A'
		}
		f.Add(string(corrupted))
	}

	f.Fuzz(func(t *testing.T, input string) {
		// The decoder must never panic on arbitrary input. Errors are expected
		// and acceptable; panics or out-of-bounds slices are not.
		_, _ = Decode(VersionByteAccountID, input)
	})
}
