package parser

import (
	"strings"
	"testing"
)

func TestParseStatementText(t *testing.T) {
	text := `HDFC Bank Account Statement
Statement Period: 01-06-2026 to 30-06-2026

01-06-2026 UPI/SWIGGY FOOD 450.00 12,345.67
02-06-2026 NEFT SALARY CREDIT 75,000.00 87,345.67
03-06-2026 ATM WITHDRAWAL 2000.00 85,345.67
04-06-2026 AMAZON PAY SHOPPING 1299.50 84,046.17
Closing Balance: 84,046.17`

	result := ParseStatementText(text)
	if len(result.Lines) != 4 {
		t.Fatalf("expected 4 lines, got %d", len(result.Lines))
	}

	if result.Lines[0].Title != "UPI/SWIGGY FOOD" || result.Lines[0].Type != "expense" {
		t.Errorf("unexpected first line: %+v", result.Lines[0])
	}
	if result.Lines[1].Type != "income" || result.Lines[1].Amount != 75000 {
		t.Errorf("expected salary income, got %+v", result.Lines[1])
	}
	if result.Lines[2].Amount != 2000 {
		t.Errorf("expected ATM withdrawal 2000, got %v", result.Lines[2].Amount)
	}
}

func TestParseStatementCSV(t *testing.T) {
	text := strings.Join([]string{
		"Date,Description,Debit,Credit,Balance",
		"01/06/2026,UBER RIDE,320.00,,10000.00",
		"02/06/2026,SALARY CREDIT,,50000.00,60000.00",
	}, "\n")

	result := ParseStatementText(text)
	if len(result.Lines) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(result.Lines))
	}
	if result.Lines[0].Type != "expense" || result.Lines[1].Type != "income" {
		t.Errorf("unexpected types: %+v, %+v", result.Lines[0], result.Lines[1])
	}
}

func TestParseStatementText_ISODates(t *testing.T) {
	text := `Bank Statement
2026-06-01 UPI/SWIGGY FOOD 450.00 12,345.67
2026/06/02 NEFT SALARY CREDIT 75,000.00 87,345.67`

	result := ParseStatementText(text)
	if len(result.Lines) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(result.Lines))
	}
	if result.Lines[0].Date.Year() != 2026 || result.Lines[0].Date.Month() != 6 || result.Lines[0].Date.Day() != 1 {
		t.Errorf("unexpected date for line 0: %v", result.Lines[0].Date)
	}
	if result.Lines[1].Date.Year() != 2026 || result.Lines[1].Date.Month() != 6 || result.Lines[1].Date.Day() != 2 {
		t.Errorf("unexpected date for line 1: %v", result.Lines[1].Date)
	}
}
