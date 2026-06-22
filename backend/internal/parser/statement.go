package parser

import (
	"regexp"
	"strings"
	"time"
)

type ParsedStatementLine struct {
	Date     time.Time `json:"date"`
	Title    string    `json:"title"`
	Amount   float64   `json:"amount"`
	Type     string    `json:"type"` // expense | income
	Category string    `json:"category"`
}

type ParsedStatement struct {
	AccountName string                `json:"account_name"`
	PeriodStart time.Time             `json:"period_start"`
	PeriodEnd   time.Time             `json:"period_end"`
	Lines       []ParsedStatementLine `json:"lines"`
}

var (
	statementDateRe = regexp.MustCompile(`\b(\d{4}[-/\.]\d{2}[-/\.]\d{2}|\d{2}[-/\.]\d{2}[-/\.]\d{2,4})\b`)
	amountRe        = regexp.MustCompile(`(?:Rs\.?|INR|USD|\$)?\s*([0-9,]+\.[0-9]{2})`)
	skipLineRe      = regexp.MustCompile(`(?i)(opening\s+balance|closing\s+balance|brought\s+forward|carried\s+forward|statement\s+period|account\s+number|ifsc|branch\s+name|page\s+\d|total\s+debit|total\s+credit|available\s+balance)`)
	creditHintRe    = regexp.MustCompile(`(?i)(^|\s)(cr|credit|salary|refund|received|deposit|interest\s+credit|neft\s+cr|imps\s+cr|upi\s+cr|transfer\s+from)`)
	debitHintRe     = regexp.MustCompile(`(?i)(^|\s)(dr|debit|withdraw|payment|purchase|paid|upi\s+dr|neft\s+dr|atm|pos|emi|charge|fee)`)
)

// ParseStatementText extracts multiple transaction lines from bank statement text.
func ParseStatementText(text string) *ParsedStatement {
	lines := strings.Split(text, "\n")
	result := &ParsedStatement{
		AccountName: extractAccountName(lines),
		Lines:       []ParsedStatementLine{},
	}

	var periodStart, periodEnd time.Time
	hasPeriod := false

	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if line == "" || skipLineRe.MatchString(line) {
			continue
		}

		if start, end, ok := extractStatementPeriod(line); ok {
			periodStart, periodEnd = start, end
			hasPeriod = true
			continue
		}

		parsed := parseStatementLine(line)
		if parsed == nil {
			continue
		}

		result.Lines = append(result.Lines, *parsed)
	}

	if hasPeriod {
		result.PeriodStart = periodStart
		result.PeriodEnd = periodEnd
	}

	return result
}

func extractAccountName(lines []string) string {
	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		lower := strings.ToLower(line)
		if strings.Contains(lower, "account holder") || strings.Contains(lower, "customer name") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 && strings.TrimSpace(parts[1]) != "" {
				return strings.TrimSpace(parts[1])
			}
		}
		if strings.Contains(lower, "hdfc bank") {
			return "HDFC Bank"
		}
		if strings.Contains(lower, "icici bank") {
			return "ICICI Bank"
		}
		if strings.Contains(lower, "state bank of india") || strings.Contains(lower, " sbi ") {
			return "SBI"
		}
	}
	return "Bank Account"
}

func extractStatementPeriod(line string) (time.Time, time.Time, bool) {
	lower := strings.ToLower(line)
	if !strings.Contains(lower, "statement") && !strings.Contains(lower, "period") && !strings.Contains(lower, "from") {
		return time.Time{}, time.Time{}, false
	}

	dates := statementDateRe.FindAllString(line, -1)
	if len(dates) < 2 {
		return time.Time{}, time.Time{}, false
	}

	start := parseStatementDate(dates[0])
	end := parseStatementDate(dates[1])
	if start.IsZero() || end.IsZero() {
		return time.Time{}, time.Time{}, false
	}
	return start, end, true
}

func parseStatementLine(line string) *ParsedStatementLine {
	if strings.Contains(line, ",") && strings.Count(line, ",") >= 2 {
		if parsed := parseCSVStatementLine(line); parsed != nil {
			return parsed
		}
	}

	dateMatch := statementDateRe.FindStringSubmatch(line)
	if len(dateMatch) < 2 {
		return nil
	}

	date := parseStatementDate(dateMatch[1])
	if date.IsZero() {
		return nil
	}

	remainder := strings.TrimSpace(line[len(dateMatch[0]):])
	if remainder == "" {
		return nil
	}

	amounts := amountRe.FindAllStringSubmatch(remainder, -1)
	if len(amounts) == 0 {
		return nil
	}

	title, txType := extractTitleAndType(remainder, amounts)
	if title == "" {
		return nil
	}
	title = CleanTransactionTitle(title)

	amount := 0.0
	if len(amounts) >= 2 {
		// Common bank format: date description txn_amount balance
		amount = parseAmount(amounts[len(amounts)-2][1])
		
		// Spacing detection for fixed-width columns
		submatches := amountRe.FindAllStringSubmatchIndex(remainder, -1)
		if len(submatches) >= 2 {
			txnSub := submatches[len(submatches)-2]
			balSub := submatches[len(submatches)-1]
			if len(txnSub) >= 4 && len(balSub) >= 4 {
				gapStr := remainder[txnSub[3]:balSub[2]]
				if len(gapStr) >= 5 && strings.TrimSpace(gapStr) == "" {
					if len(gapStr) <= 18 {
						txType = "income"
					} else {
						txType = "expense"
					}
				}
			}
		}

		if txType == "" {
			txType = inferTypeFromDescription(title)
		}
	} else {
		amount = parseAmount(amounts[0][1])
		if amount <= 0 {
			return nil
		}
		if txType == "" {
			txType = inferTypeFromDescription(title)
		}
	}

	if txType == "" {
		txType = "expense"
	}

	return &ParsedStatementLine{
		Date:     date,
		Title:    title,
		Amount:   amount,
		Type:     txType,
		Category: categorizeStatementLine(title, txType),
	}
}

func parseCSVStatementLine(line string) *ParsedStatementLine {
	parts := splitCSVLine(line)
	if len(parts) < 3 {
		return nil
	}

	date := parseStatementDate(strings.TrimSpace(parts[0]))
	if date.IsZero() {
		return nil
	}

	title := strings.TrimSpace(parts[1])
	if title == "" {
		return nil
	}
	title = CleanTransactionTitle(title)

	debit := 0.0
	credit := 0.0
	if len(parts) >= 4 {
		debit = parseAmount(strings.TrimSpace(parts[2]))
		credit = parseAmount(strings.TrimSpace(parts[3]))
	} else {
		val := parseAmount(strings.TrimSpace(parts[2]))
		if val <= 0 {
			return nil
		}
		if inferTypeFromDescription(title) == "income" {
			credit = val
		} else {
			debit = val
		}
	}

	txType := "expense"
	amount := debit
	if credit > 0 && debit == 0 {
		txType = "income"
		amount = credit
	} else if debit <= 0 {
		return nil
	}

	return &ParsedStatementLine{
		Date:     date,
		Title:    title,
		Amount:   amount,
		Type:     txType,
		Category: categorizeStatementLine(title, txType),
	}
}

func splitCSVLine(line string) []string {
	return strings.Split(line, ",")
}

func extractTitleAndType(remainder string, amounts [][]string) (string, string) {
	titlePart := remainder
	for _, match := range amounts {
		titlePart = strings.Replace(titlePart, match[0], " ", 1)
	}

	titlePart = regexp.MustCompile(`(?i)\b(dr|cr|debit|credit)\b`).ReplaceAllString(titlePart, " ")
	titlePart = strings.Join(strings.Fields(titlePart), " ")
	titlePart = strings.Trim(titlePart, "|-,")

	txType := ""
	lower := strings.ToLower(titlePart + " " + remainder)
	if creditHintRe.MatchString(lower) {
		txType = "income"
	} else if debitHintRe.MatchString(lower) {
		txType = "expense"
	}

	return titlePart, txType
}

func inferTypeFromDescription(desc string) string {
	lower := strings.ToLower(desc)
	if creditHintRe.MatchString(lower) {
		return "income"
	}
	if debitHintRe.MatchString(lower) {
		return "expense"
	}
	return "expense"
}

func categorizeStatementLine(title, txType string) string {
	if txType == "income" {
		lower := strings.ToLower(title)
		if strings.Contains(lower, "salary") {
			return "Salary"
		}
		return "Other"
	}
	return CategorizeMerchant(title)
}

func parseStatementDate(raw string) time.Time {
	for _, layout := range []string{"2006-01-02", "2006/01/02", "2006.01.02", "02-01-2006", "01-02-2006", "02/01/2006", "01/02/2006", "02.01.2006", "01.02.2006", "02-01-06", "01-02-06", "02/01/06", "01/02/06", "02.01.06", "01.02.06"} {
		if t, err := time.Parse(layout, raw); err == nil {
			return t
		}
	}
	return time.Time{}
}

// CleanTransactionTitle refines raw statement narration into a clean merchant name.
func CleanTransactionTitle(rawTitle string) string {
	// 1. Remove dates (e.g. DD/MM/YY, DD-MM-YYYY, YYYY-MM-DD, etc.)
	datePattern := regexp.MustCompile(`\b(\d{2,4}[-/\.]\d{2}[-/\.]\d{2,4})\b`)
	cleaned := datePattern.ReplaceAllString(rawTitle, " ")

	// 2. Remove long digit sequences (reference/chq/phone numbers, 8+ digits)
	refPattern := regexp.MustCompile(`\b\d{8,}\b`)
	cleaned = refPattern.ReplaceAllString(cleaned, " ")

	// 3. Remove email-like UPI IDs or trailing details after '@'
	if atIdx := strings.Index(cleaned, "@"); atIdx != -1 {
		cleaned = cleaned[:atIdx]
	}

	// 4. Remove common prefixes
	prefixes := []string{
		"UPI-", "REV-UPI-", "IMPS-", "NEFT-", "ACH D-", "FT-", "RTGS-", "POS-", "REV-", "AUTOPAY-",
		"UPI/", "IMPS/", "NEFT/", "ACH/", "FT/", "RTGS/", "POS/", "REV/", "AUTOPAY/",
		"UPI ", "IMPS ", "NEFT ", "ACH ", "FT ", "RTGS ", "POS ", "REV ", "AUTOPAY ",
	}
	for _, p := range prefixes {
		if strings.HasPrefix(strings.ToUpper(cleaned), p) {
			cleaned = cleaned[len(p):]
		}
	}

	// Remove common payment channel tokens
	paymentProviders := []string{"-PAYTM-", "-PHONEPE-", "-GPAY-", "-BHIM-", "-PAYZAPP-", "-AMAZONPAY-", "PAYTM", "PHONEPE", "GPAY", "BHIM", "PAYZAPP"}
	for _, provider := range paymentProviders {
		cleaned = strings.ReplaceAll(cleaned, provider, " ")
	}

	// 5. Clean up hyphenated numeric suffixes or short codes at the end.
	cleaned = regexp.MustCompile(`\s*-\s*[A-Za-z]*[0-9]+[A-Za-z0-9]*\s*$`).ReplaceAllString(cleaned, "")
	cleaned = regexp.MustCompile(`\s*-\s*$`).ReplaceAllString(cleaned, "")

	// 6. Split by separators and deduplicate tokens
	tokens := strings.FieldsFunc(cleaned, func(r rune) bool {
		return r == '-' || r == ' ' || r == '/' || r == '|' || r == '_'
	})

	var uniqueTokens []string
	seen := make(map[string]bool)
	for _, token := range tokens {
		tUpper := strings.ToUpper(token)
		// Skip common noise words
		if tUpper == "UPI" || tUpper == "PAYTM" || tUpper == "GPAY" || tUpper == "PHONEPE" || tUpper == "IMPS" || tUpper == "NEFT" || tUpper == "FT" || tUpper == "REV" || tUpper == "REMARK" || tUpper == "REMARKS" || tUpper == "NO" || tUpper == "VIA" || tUpper == "CRED" || tUpper == "PAY" || tUpper == "TO" || tUpper == "FROM" || tUpper == "ACH" || tUpper == "BD" || tUpper == "TP" {
			continue
		}
		// Skip short alphanumeric fragments/codes
		if len(token) > 4 && regexp.MustCompile(`[0-9]`).MatchString(token) && !regexp.MustCompile(`^[A-Za-z]+[0-9]+$`).MatchString(token) {
			continue
		}
		if !seen[tUpper] {
			seen[tUpper] = true
			uniqueTokens = append(uniqueTokens, token)
		}
	}

	if len(uniqueTokens) == 0 {
		return strings.Join(strings.Fields(rawTitle), " ")
	}

	return strings.TrimSpace(strings.Join(uniqueTokens, " "))
}
