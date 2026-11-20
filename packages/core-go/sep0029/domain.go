package sep0029

import "strings"

const (
	maxDomainLength = 253
	maxLabelLength  = 63
)

// validDomain accepts an RFC 1035 hostname with an optional numeric port.
func validDomain(domain string) bool {
	if domain == "" {
		return false
	}

	host := domain
	if colon := strings.LastIndexByte(domain, ':'); colon >= 0 {
		port := domain[colon+1:]
		if colon == 0 || port == "" {
			return false
		}
		for i := 0; i < len(port); i++ {
			if port[i] < '0' || port[i] > '9' {
				return false
			}
		}
		host = domain[:colon]
	}

	if strings.HasSuffix(host, ".") {
		host = host[:len(host)-1]
	}
	if len(host) == 0 || len(host) > maxDomainLength {
		return false
	}

	labelLength := 0
	labelFirst := byte(0)
	labelLast := byte(0)
	for i := 0; i <= len(host); i++ {
		if i < len(host) && host[i] != '.' {
			ch := host[i]
			if !isDomainCharacter(ch) {
				return false
			}
			if labelLength == 0 {
				labelFirst = ch
			}
			labelLast = ch
			labelLength++
			if labelLength > maxLabelLength {
				return false
			}
			continue
		}

		if labelLength == 0 || labelFirst == '-' || labelLast == '-' {
			return false
		}
		labelLength = 0
	}
	return true
}

func isDomainCharacter(ch byte) bool {
	return ch >= 'a' && ch <= 'z' ||
		ch >= 'A' && ch <= 'Z' ||
		ch >= '0' && ch <= '9' ||
		ch == '-'
}
