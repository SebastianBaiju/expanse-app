package parser

import (
	"regexp"
	"strconv"
	"strings"
	"time"
)

type ParsedExpense struct {
	Amount   float64
	Merchant string
	Category string
	Date     time.Time
}

// Helper to sanitize amount string and parse to float64
func parseAmount(amtStr string) float64 {
	// Remove commas and currency symbols
	amtStr = strings.ReplaceAll(amtStr, ",", "")
	amtStr = strings.ReplaceAll(amtStr, "Rs.", "")
	amtStr = strings.ReplaceAll(amtStr, "Rs", "")
	amtStr = strings.ReplaceAll(amtStr, "INR", "")
	amtStr = strings.ReplaceAll(amtStr, " ", "")

	amt, err := strconv.ParseFloat(amtStr, 64)
	if err != nil {
		return 0.0
	}
	return amt
}

// CategorizeMerchant maps merchant names to logical expense categories.
func CategorizeMerchant(merchant string) string {
	merchantLower := strings.ToLower(merchant)

	type rule struct {
		category string
		keywords []string
	}

	rules := []rule{
		{
			category: "Shopping",
			keywords: []string{"jiomart", "grocery", "groceries", "mart", "dmart", "supermarket", "spencer", "amazon", "flipkart", "myntra", "ajio", "retail", "landmark", "max retail", "seemas"},
		},
		{
			category: "Food",
			keywords: []string{"zomato", "swiggy", "starbucks", "mcdonald", "domino", "restaurant", "food", "cafe", "uber eats", "hotel", "kanthari"},
		},
		{
			category: "Travel",
			keywords: []string{"uber", "ola", "irctc", "makemytrip", "yatra", "goibibo", "fuel", "petrol", "shell", "hpcl", "bpcl", "metro", "flight", "fuels", "girilal"},
		},
		{
			category: "Entertainment",
			keywords: []string{"netflix", "spotify", "prime video", "disney", "hotstar", "bookmyshow", "cinema", "movie", "theater", "gaming", "steam", "tata play"},
		},
		{
			category: "Utilities",
			keywords: []string{"electricity", "water", "gas", "bsnl", "jio", "airtel", "vi ", "recharge", "broadband", "insurance", "act fiber"},
		},
	}

	for _, r := range rules {
		for _, kw := range r.keywords {
			if strings.Contains(merchantLower, kw) {
				return r.category
			}
		}
	}

	return "Other"
}

// ParseEmail parses a transaction email based on standard templates.
func ParseEmail(subject, body string, receivedTime time.Time) (*ParsedExpense, bool) {
	subjectLower := strings.ToLower(subject)
	bodyLower := strings.ToLower(body)

	// --- 1. Amazon Order Confirmations ---
	if strings.Contains(subjectLower, "amazon") && (strings.Contains(subjectLower, "order") || strings.Contains(subjectLower, "confirm") || strings.Contains(subjectLower, "thank you")) {
		// Patterns: "Order Grand Total: Rs. 1,200.00" or "Grand Total: Rs.1,200.00"
		re := regexp.MustCompile(`(?i)(?:order total|grand total|amount paid|total amount)\s*:?\s*(?:rs\.?|inr|usd)?\s*([0-9,]+\.[0-9]{2}|[0-9,]+)`)
		if matches := re.FindStringSubmatch(body); len(matches) > 1 {
			return &ParsedExpense{
				Amount:   parseAmount(matches[1]),
				Merchant: "Amazon",
				Category: "Shopping",
				Date:     receivedTime,
			}, true
		}
	}

	// --- 2. Flipkart Order Confirmations ---
	if strings.Contains(subjectLower, "flipkart") && (strings.Contains(subjectLower, "order") || strings.Contains(subjectLower, "confirm")) {
		re := regexp.MustCompile(`(?i)(?:total price|amount paid|total amount|payable amount)\s*:?\s*(?:rs\.?|inr|usd)?\s*([0-9,]+\.[0-9]{2}|[0-9,]+)`)
		if matches := re.FindStringSubmatch(body); len(matches) > 1 {
			return &ParsedExpense{
				Amount:   parseAmount(matches[1]),
				Merchant: "Flipkart",
				Category: "Shopping",
				Date:     receivedTime,
			}, true
		}
	}

	// --- 3. HDFC Bank Transaction Emails ---
	if strings.Contains(subjectLower, "hdfc") || strings.Contains(bodyLower, "hdfc bank") {
		// Credit Card Spend: "spent Rs. 1,500.00 on Credit Card xx1234 at Amazon" or similar
		ccRe := regexp.MustCompile(`(?i)(?:spent|spent Rs\.|spent INR)\s*([0-9,]+\.[0-9]{2}|[0-9,]+)\s*(?:on)?\s*credit card\s*(?:.*?)at\s*([^.]+)\.`)
		if matches := ccRe.FindStringSubmatch(body); len(matches) > 2 {
			merchant := strings.TrimSpace(matches[2])
			return &ParsedExpense{
				Amount:   parseAmount(matches[1]),
				Merchant: merchant,
				Category: CategorizeMerchant(merchant),
				Date:     receivedTime,
			}, true
		}

		// UPI / Debit Card: "debited by Rs.500.00", "debited with Rs. 500.00", "sent Rs. 500.00"
		upiRe := regexp.MustCompile(`(?i)(?:debited by|debited with|sent)\s*(?:rs\.?|inr)?\s*([0-9,]+\.[0-9]{2}|[0-9,]+)\s*(?:to|at)\s*([^.]+)\.`)
		if matches := upiRe.FindStringSubmatch(body); len(matches) > 2 {
			merchant := strings.TrimSpace(matches[2])
			return &ParsedExpense{
				Amount:   parseAmount(matches[1]),
				Merchant: merchant,
				Category: CategorizeMerchant(merchant),
				Date:     receivedTime,
			}, true
		}
	}

	// --- 4. ICICI Bank Transaction Emails ---
	if strings.Contains(subjectLower, "icici") || strings.Contains(bodyLower, "icici bank") {
		// Credit Card: "spent INR 2,500.00 on card xx5678. Info: Zomato"
		ccRe := regexp.MustCompile(`(?i)(?:spent|transaction of)\s*(?:inr|rs\.?)?\s*([0-9,]+\.[0-9]{2}|[0-9,]+)\s*(?:on|with)?\s*card\s*(?:.*?)(?:info:|at)\s*([^.]+)\.`)
		if matches := ccRe.FindStringSubmatch(body); len(matches) > 2 {
			merchant := strings.TrimSpace(matches[2])
			return &ParsedExpense{
				Amount:   parseAmount(matches[1]),
				Merchant: merchant,
				Category: CategorizeMerchant(merchant),
				Date:     receivedTime,
			}, true
		}

		// UPI Debit: "Your A/C xx123 has been debited for Rs 150.00 on UPI transfer to Swiggy"
		upiRe := regexp.MustCompile(`(?i)debited for\s*(?:rs\.?|inr)?\s*([0-9,]+\.[0-9]{2}|[0-9,]+)\s*(?:on|due to|to)\s*UPI transfer to\s*([^.]+)(?:\.|\s|$)`)
		if matches := upiRe.FindStringSubmatch(body); len(matches) > 2 {
			merchant := strings.TrimSpace(matches[2])
			return &ParsedExpense{
				Amount:   parseAmount(matches[1]),
				Merchant: merchant,
				Category: CategorizeMerchant(merchant),
				Date:     receivedTime,
			}, true
		}
	}

	// Fallback/Generic transaction parse in case email matches bank keywords but no specific pattern
	if strings.Contains(subjectLower, "transaction") || strings.Contains(subjectLower, "spent") || strings.Contains(subjectLower, "alert") || strings.Contains(subjectLower, "debit") {
		reAmount := regexp.MustCompile(`(?i)(?:debited|spent|paid|amount|total)\s*(?:rs\.?|inr|usd|\$)?\s*([0-9,]+\.[0-9]{2}|[0-9,]+)`)
		if matches := reAmount.FindStringSubmatch(body); len(matches) > 1 {
			return &ParsedExpense{
				Amount:   parseAmount(matches[1]),
				Merchant: "Bank Alert",
				Category: "Other",
				Date:     receivedTime,
			}, true
		}
	}

	return nil, false
}
