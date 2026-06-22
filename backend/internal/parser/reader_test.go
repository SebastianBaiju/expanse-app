package parser

import (
	"os"
	"strings"
	"testing"
)

func TestReadStatementReader(t *testing.T) {
	text := `SBI Bank Statement
Statement Period: 01-06-2026 to 30-06-2026

01-06-2026 ZOMATO FOOD ORDER 350.00 10000.00
02-06-2026 SALARY CREDIT 50000.00 60000.00
`
	reader := strings.NewReader(text)
	result, err := ReadStatementReader(reader)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.Lines) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(result.Lines))
	}

	if result.Lines[0].Title != "ZOMATO FOOD ORDER" || result.Lines[0].Amount != 350.0 {
		t.Errorf("unexpected first line: %+v", result.Lines[0])
	}
	if result.Lines[1].Title != "SALARY" || result.Lines[1].Amount != 50000.0 || result.Lines[1].Type != "income" {
		t.Errorf("unexpected second line: %+v", result.Lines[1])
	}
}

func TestReadStatementFile(t *testing.T) {
	text := `Date,Description,Debit,Credit,Balance
01-06-2026,AMAZON IN,1500.00,,5000.00
02-06-2026,INTEREST RECEIVED,,120.00,5120.00
`
	// Create a temp file
	tmpFile, err := os.CreateTemp("", "test-statement-*.csv")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(text); err != nil {
		tmpFile.Close()
		t.Fatalf("failed to write to temp file: %v", err)
	}
	tmpFile.Close()

	result, err := ReadStatementFile(tmpFile.Name())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.Lines) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(result.Lines))
	}

	if result.Lines[0].Title != "AMAZON IN" || result.Lines[0].Amount != 1500.0 {
		t.Errorf("unexpected first line: %+v", result.Lines[0])
	}
	if result.Lines[1].Title != "INTEREST RECEIVED" || result.Lines[1].Amount != 120.0 || result.Lines[1].Type != "income" {
		t.Errorf("unexpected second line: %+v", result.Lines[1])
	}
}
