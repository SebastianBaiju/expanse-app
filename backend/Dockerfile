# Stage 1: Build the Go binary
FROM golang:alpine AS builder

# Install build tools for CGO compilation (required for sqlite3)
RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Copy dependency manifests
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary with CGO enabled
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o main cmd/main.go

# Stage 2: Minimal runner
FROM alpine:latest  

# Install CA certificates, timezone data, local Tesseract OCR, and PDF text utilities
RUN apk --no-cache add ca-certificates tzdata tesseract-ocr tesseract-ocr-data-eng poppler-utils

WORKDIR /root/

# Copy compiled binary from builder stage
COPY --from=builder /app/main /app/main

EXPOSE 8080

CMD ["/app/main"]
