# Multi-stage build for the Bluewhale Go deposit reconciliation service.
# Produces a fully static binary and a minimal scratch runtime image.

# ---- Build stage ----
FROM golang:1.22-alpine AS builder

WORKDIR /src

# Cache module downloads separately from source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build a static binary with no libc dependency.
# - CGO_ENABLED=0 removes the libc dependency entirely.
# - -trimpath and -ldflags strip debug info for a smaller, reproducible binary.
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags='-s -w -extldflags "-static"' \
    -o /out/go-exchange ./...

# ---- Runtime stage ----
FROM scratch

# CA certificates so the service can make outbound TLS calls.
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

# Only the compiled binary is shipped in the final image.
COPY --from=builder /out/go-exchange /go-exchange

# Healthcheck endpoint is served by the binary on this port.
EXPOSE 8080

# Run as a non-root user (numeric UID works on scratch).
USER 65534:65534

ENTRYPOINT ["/go-exchange"]
