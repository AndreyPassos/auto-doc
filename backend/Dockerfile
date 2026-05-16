# Stage 1: builder
FROM golang:1.22-alpine AS builder

# Install build tools
RUN apk add --no-cache git

WORKDIR /build

# Download dependencies first (layer cache)
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# Stage 2: runtime
FROM alpine:3.19

# Install runtime dependencies: poppler-utils (pdftotext), tesseract + Portuguese data
RUN apk add --no-cache \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-por \
    ca-certificates

# Non-root user for least-privilege execution
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy binary from builder
COPY --from=builder /build/server /app/server

# Create upload directory and give ownership to non-root user
RUN mkdir -p /var/uploads && chown appuser:appgroup /var/uploads

USER appuser

EXPOSE 8080

CMD ["/app/server"]
