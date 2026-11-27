package routing

import (
	"errors"
	"net/url"
	"strings"

	"github.com/REDISHFISH/BLUEWHALE/packages/core-go/intern"
)

// URIParams represents parsed SEP-0007 parameters.
type URIParams struct {
	Destination       string `json:"destination"`
	Amount            string `json:"amount,omitempty"`
	AssetCode         string `json:"assetCode,omitempty"`
	AssetIssuer       string `json:"assetIssuer,omitempty"`
	Memo              string `json:"memo,omitempty"`
	MemoType          string `json:"memoType,omitempty"`
	Callback          string `json:"callback,omitempty"`
	Msg               string `json:"msg,omitempty"`
	NetworkPassphrase string `json:"networkPassphrase,omitempty"`
	OriginDomain      string `json:"originDomain,omitempty"`
	Signature         string `json:"signature,omitempty"`
}

var (
	// ErrInvalidScheme indicates that the URI does not start with web+stellar:.
	ErrInvalidScheme = errors.New("URI must use 'web+stellar:' scheme")
	// ErrUnsupportedOperation indicates an operation other than 'pay'.
	ErrUnsupportedOperation = errors.New("unsupported operation: only 'pay' is supported")
	// ErrMissingDestination indicates that the destination parameter is absent or empty.
	ErrMissingDestination = errors.New("missing required 'destination' parameter")
)

// mapSep7MemoType maps SEP-0007 memo_type strings to internal RoutingInput memoType values.
func mapSep7MemoType(sep7MemoType string) string {
	upper := strings.ToUpper(strings.TrimSpace(sep7MemoType))
	switch upper {
	case "MEMO_ID":
		return "id"
	case "MEMO_TEXT":
		return "text"
	case "MEMO_HASH":
		return "hash"
	case "MEMO_RETURN":
		return "return"
	default:
		return "none"
	}
}

// ExtractRoutingFromURI parses a SEP-0007 payment URI (e.g. web+stellar:pay?destination=...)
// and delegates to ExtractRouting to extract canonical routing information.
func ExtractRoutingFromURI(uriStr string) (RoutingResult, URIParams, error) {
	if !strings.HasPrefix(uriStr, "web+stellar:") {
		return RoutingResult{Success: false, ErrorMessage: ErrInvalidScheme.Error()}, URIParams{}, ErrInvalidScheme
	}

	withoutScheme := strings.TrimPrefix(uriStr, "web+stellar:")
	parts := strings.SplitN(withoutScheme, "?", 2)
	operation := parts[0]
	queryString := ""
	if len(parts) > 1 {
		queryString = parts[1]
	}

	if operation != "pay" {
		return RoutingResult{Success: false, ErrorMessage: ErrUnsupportedOperation.Error()}, URIParams{}, ErrUnsupportedOperation
	}

	values, err := url.ParseQuery(queryString)
	if err != nil {
		return RoutingResult{Success: false, ErrorMessage: err.Error()}, URIParams{}, err
	}

	destination := strings.TrimSpace(values.Get("destination"))
	if destination == "" {
		return RoutingResult{Success: false, ErrorMessage: ErrMissingDestination.Error()}, URIParams{}, ErrMissingDestination
	}

	params := URIParams{
		Destination: destination,
		Amount:      values.Get("amount"),
		// Intern asset codes and issuer addresses: these short strings repeat
		// heavily across payment operations and sharing references reduces GC
		// scanning pressure and allocation count.
		AssetCode:         intern.InternAssetString(values.Get("asset_code")),
		AssetIssuer:       intern.InternAssetString(values.Get("asset_issuer")),
		Memo:              values.Get("memo"),
		MemoType:          values.Get("memo_type"),
		Callback:          values.Get("callback"),
		Msg:               values.Get("msg"),
		NetworkPassphrase: values.Get("network_passphrase"),
		OriginDomain:      values.Get("origin_domain"),
		Signature:         values.Get("signature"),
	}

	routingInput := RoutingInput{
		Destination: params.Destination,
		MemoType:    mapSep7MemoType(params.MemoType),
		MemoValue:   params.Memo,
	}

	result := ExtractRouting(routingInput)
	return result, params, nil
}
