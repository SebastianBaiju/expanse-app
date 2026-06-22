package parser

import (
	"fmt"
	"io"
	"os"
)

// ReadStatementFile reads a bank statement from a file path and parses it.
func ReadStatementFile(filePath string) (*ParsedStatement, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	return ReadStatementReader(file)
}

// ReadStatementReader reads bank statement text from an io.Reader and parses it.
func ReadStatementReader(r io.Reader) (*ParsedStatement, error) {
	content, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("failed to read content: %w", err)
	}

	parsed := ParseStatementText(string(content))
	return parsed, nil
}
