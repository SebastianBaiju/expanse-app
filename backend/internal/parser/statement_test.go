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

	if result.Lines[0].Title != "SWIGGY FOOD" || result.Lines[0].Type != "expense" {
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

func TestParseStatementText_HDFCFormat(t *testing.T) {
	text := `HDFC BANK Ltd.                                     Page No .:   1                                        Statement of accounts
Date      Narration				    Chq./Ref.No.      Value Dt  Withdrawal Amt.        Deposit Amt.     Closing Balance
01/06/26  UPI-JIOMARTGROCERY-PAYTM-JIOMARTGROCERY@  0000164504124553  01/06/26             128.00                             273,495.86   
02/06/26  FT- SEBASTIAN-50200023438931 - BEINEX CO  0000001667272034  02/06/26                            104,844.00          377,534.86   
02/06/26  REV-UPI-50100447981632-SEBU9495-3@OKICIC  0000615349933546  02/06/26                              6,000.00          377,534.86   
03/06/26  UPI-JIOMARTGROCERY-PAYTM-JIOMARTGROCERY@  0000221757331258  03/06/26             182.60                             370,607.26   
04/06/26  UPI-NPCI BHIM-BHIMCASHBACK@HDFCBANK-HDFC  0000103420495290  04/06/26                                  8.05          360,711.31   
`
	result := ParseStatementText(text)
	if len(result.Lines) != 5 {
		t.Fatalf("expected 5 lines, got %d", len(result.Lines))
	}

	// 01/06/26 UPI-JIOMARTGROCERY... -> 128.00 Withdrawal (expense)
	if result.Lines[0].Type != "expense" || result.Lines[0].Amount != 128.00 {
		t.Errorf("expected expense 128.00 for line 0, got %s %f", result.Lines[0].Type, result.Lines[0].Amount)
	}
	if result.Lines[0].Title != "JIOMARTGROCERY" || result.Lines[0].Category != "Shopping" {
		t.Errorf("expected title 'JIOMARTGROCERY' and category 'Shopping' for line 0, got title '%s', category '%s'", result.Lines[0].Title, result.Lines[0].Category)
	}
	if result.Lines[0].Date.Year() != 2026 || result.Lines[0].Date.Month() != 6 || result.Lines[0].Date.Day() != 1 {
		t.Errorf("expected date 2026-06-01 for line 0, got %v", result.Lines[0].Date)
	}

	// 02/06/26 FT- SEBASTIAN... -> 104,844.00 Deposit (income)
	if result.Lines[1].Type != "income" || result.Lines[1].Amount != 104844.00 {
		t.Errorf("expected income 104844.00 for line 1, got %s %f", result.Lines[1].Type, result.Lines[1].Amount)
	}
	if result.Lines[1].Title != "SEBASTIAN BEINEX CO" || result.Lines[1].Category != "Other" {
		t.Errorf("expected title 'SEBASTIAN BEINEX CO' and category 'Other' for line 1, got title '%s', category '%s'", result.Lines[1].Title, result.Lines[1].Category)
	}

	// 02/06/26 REV-UPI... -> 6,000.00 Deposit (income)
	if result.Lines[2].Type != "income" || result.Lines[2].Amount != 6000.00 {
		t.Errorf("expected income 6000.00 for line 2, got %s %f", result.Lines[2].Type, result.Lines[2].Amount)
	}
	if result.Lines[2].Title != "SEBU9495" || result.Lines[2].Category != "Other" {
		t.Errorf("expected title 'SEBU9495' and category 'Other' for line 2, got title '%s', category '%s'", result.Lines[2].Title, result.Lines[2].Category)
	}

	// 03/06/26 UPI-JIOMARTGROCERY... -> 182.60 Withdrawal (expense)
	if result.Lines[3].Type != "expense" || result.Lines[3].Amount != 182.60 {
		t.Errorf("expected expense 182.60 for line 3, got %s %f", result.Lines[3].Type, result.Lines[3].Amount)
	}
	if result.Lines[3].Title != "JIOMARTGROCERY" || result.Lines[3].Category != "Shopping" {
		t.Errorf("expected title 'JIOMARTGROCERY' and category 'Shopping' for line 3, got title '%s', category '%s'", result.Lines[3].Title, result.Lines[3].Category)
	}

	// 04/06/26 UPI-NPCI BHIM... -> 8.05 Deposit (income)
	if result.Lines[4].Type != "income" || result.Lines[4].Amount != 8.05 {
		t.Errorf("expected income 8.05 for line 4, got %s %f", result.Lines[4].Type, result.Lines[4].Amount)
	}
	if result.Lines[4].Title != "NPCI CASHBACK" || result.Lines[4].Category != "Other" {
		t.Errorf("expected title 'NPCI CASHBACK' and category 'Other' for line 4, got title '%s', category '%s'", result.Lines[4].Title, result.Lines[4].Category)
	}
}
