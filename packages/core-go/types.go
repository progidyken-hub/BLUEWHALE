package core

import (
	"encoding/json"
	"fmt"
)

// DestinationType represents the type of a deposit destination.
type DestinationType int

const (
	// DestinationTypeAccount is a standard Stellar account destination.
	DestinationTypeAccount DestinationType = iota
	// DestinationTypeMuxed is a muxed account destination.
	DestinationTypeMuxed
)

// String returns the string representation of the DestinationType.
func (d DestinationType) String() string {
	switch d {
	case DestinationTypeAccount:
		return "account"
	case DestinationTypeMuxed:
		return "muxed"
	default:
		return fmt.Sprintf("DestinationType(%d)", int(d))
	}
}

// MarshalJSON implements json.Marshaler, serializing the enum as a string.
func (d DestinationType) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.String())
}

// UnmarshalJSON implements json.Unmarshaler, accepting the string form of the enum.
func (d *DestinationType) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	return d.parseString(s)
}

// MarshalText implements encoding.TextMarshaler.
func (d DestinationType) MarshalText() ([]byte, error) {
	return []byte(d.String()), nil
}

// UnmarshalText implements encoding.TextUnmarshaler.
func (d *DestinationType) UnmarshalText(text []byte) error {
	return d.parseString(string(text))
}

func (d *DestinationType) parseString(s string) error {
	switch s {
	case "account":
		*d = DestinationTypeAccount
	case "muxed":
		*d = DestinationTypeMuxed
	default:
		return fmt.Errorf("invalid DestinationType: %q", s)
	}
	return nil
}
