package parser

import (
	"regexp"
	"strings"
	"time"
)

type ParsedBill struct {
	Amount   float64   `json:"amount"`
	Merchant string    `json:"merchant"`
	Category string    `json:"category"`
	Date     time.Time `json:"date"`
}

// ParseBillText extracts transaction details from a block of text.
func ParseBillText(text string) *ParsedBill {
	lines := strings.Split(text, "\n")
	var cleanedLines []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			cleanedLines = append(cleanedLines, trimmed)
		}
	}

	if len(cleanedLines) == 0 {
		return &ParsedBill{
			Amount:   0.0,
			Merchant: "Unknown Merchant",
			Category: "Other",
			Date:     time.Now(),
		}
	}

	// 1. Try to guess Merchant name
	// Usually the first line is the store name (e.g. "WALMART", "STARBUCKS", "McDonald's")
	merchant := "Unknown Merchant"
	for _, line := range cleanedLines {
		// Skip lines that have dates, phone numbers, or look like table headers
		lower := strings.ToLower(line)
		if strings.Contains(lower, "date") || strings.Contains(lower, "tel:") || strings.Contains(lower, "phone") ||
			strings.Contains(lower, "tax") || strings.Contains(lower, "invoice") || strings.Contains(lower, "receipt") ||
			strings.Contains(lower, "welcome") || len(line) < 3 {
			continue
		}
		// First line that doesn't match the above is probably the merchant
		merchant = line
		break
	}

	// 2. Try to find the total amount using regexes
	amount := 0.0
	// Search lines for keywords like Total, Grand Total, Net, etc.
	// Ordered by priority
	totalRegexes := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(?:grand\s+)?total(?:\s+due|\s+payable|\s+amount)?\s*(?::|=)?\s*(?:rs\.?|inr|usd|\$)?\s*([0-9,]+\.[0-9]{2}|[0-9,]+)`),
		regexp.MustCompile(`(?i)(?:amount\s+payable|net\s+amount|to\s+pay|total)\s*(?::|=)?\s*(?:rs\.?|inr|usd|\$)?\s*([0-9,]+\.[0-9]{2}|[0-9,]+)`),
		regexp.MustCompile(`(?i)subtotal\s*(?::|=)?\s*(?:rs\.?|inr|usd|\$)?\s*([0-9,]+\.[0-9]{2}|[0-9,]+)`),
		regexp.MustCompile(`(?i)paid\s*(?::|=)?\s*(?:rs\.?|inr|usd|\$)?\s*([0-9,]+\.[0-9]{2}|[0-9,]+)`),
	}

	foundAmount := false
	for _, re := range totalRegexes {
		for _, line := range cleanedLines {
			if matches := re.FindStringSubmatch(line); len(matches) > 1 {
				amount = parseAmount(matches[1])
				if amount > 0 {
					foundAmount = true
					break
				}
			}
		}
		if foundAmount {
			break
		}
	}

	// If no total keyword was matched, fallback to finding the largest number in the text
	if amount == 0 {
		numberRe := regexp.MustCompile(`(?:rs\.?|inr|usd|\$)?\s*([0-9,]+\.[0-9]{2})`)
		maxVal := 0.0
		for _, line := range cleanedLines {
			if matches := numberRe.FindAllStringSubmatch(line, -1); len(matches) > 0 {
				for _, match := range matches {
					val := parseAmount(match[1])
					if val > maxVal {
						maxVal = val
					}
				}
			}
		}
		amount = maxVal
	}

	// 3. Try to parse date
	date := time.Now()
	dateRe := regexp.MustCompile(`\b\d{2}[-/\.]\d{2}[-/\.]\d{2,4}\b`)
	for _, line := range cleanedLines {
		if match := dateRe.FindString(line); match != "" {
			// Try parsing as DD-MM-YYYY or MM-DD-YYYY
			for _, layout := range []string{"02-01-2006", "01-02-2006", "02/01/2006", "01/02/2006", "02.01.2006", "01.02.2006", "02-01-06", "01-02-06"} {
				if t, err := time.Parse(layout, match); err == nil {
					date = t
					break
				}
			}
			break
		}
	}

	return &ParsedBill{
		Amount:   amount,
		Merchant: merchant,
		Category: CategorizeMerchant(merchant),
		Date:     date,
	}
}
