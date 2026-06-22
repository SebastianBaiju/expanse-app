package parser

import (
	"testing"
	"time"
)

func TestParseEmail(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name          string
		subject       string
		body          string
		expectedOk    bool
		expectedMerchant string
		expectedAmount   float64
		expectedCategory string
	}{
		{
			name:             "Amazon Confirmation",
			subject:          "Your Amazon.in order confirmation #403-123",
			body:             "Thank you for shopping. Order Grand Total: Rs. 1,299.00. We will ship it soon.",
			expectedOk:       true,
			expectedMerchant: "Amazon",
			expectedAmount:   1299.00,
			expectedCategory: "Shopping",
		},
		{
			name:             "Flipkart Confirmation",
			subject:          "Flipkart: Order placed successfully",
			body:             "Your order is confirmed. Payable Amount: Rs. 450.00 through Credit Card.",
			expectedOk:       true,
			expectedMerchant: "Flipkart",
			expectedAmount:   450.00,
			expectedCategory: "Shopping",
		},
		{
			name:             "HDFC Credit Card Spend",
			subject:          "HDFC Bank Alert: Credit Card Transaction",
			body:             "You have spent Rs. 1,500.00 on Credit Card xx1234 at Starbucks.",
			expectedOk:       true,
			expectedMerchant: "Starbucks",
			expectedAmount:   1500.00,
			expectedCategory: "Food",
		},
		{
			name:             "HDFC UPI Debit",
			subject:          "HDFC Bank: Account Debited Alert",
			body:             "Your A/C xx4455 is debited by Rs. 200.00 to Ola.",
			expectedOk:       true,
			expectedMerchant: "Ola",
			expectedAmount:   200.00,
			expectedCategory: "Travel",
		},
		{
			name:             "ICICI Credit Card Spend",
			subject:          "ICICI Bank - Card Transaction Alert",
			body:             "You spent INR 2,500.00 on card xx5678. Info: Netflix.",
			expectedOk:       true,
			expectedMerchant: "Netflix",
			expectedAmount:   2500.00,
			expectedCategory: "Entertainment",
		},
		{
			name:             "ICICI UPI Debit",
			subject:          "ICICI Bank UPI Debit Alert",
			body:             "Your A/C xx123 has been debited for Rs 150.00 on UPI transfer to Swiggy.",
			expectedOk:       true,
			expectedMerchant: "Swiggy",
			expectedAmount:   150.00,
			expectedCategory: "Food",
		},
		{
			name:             "Non-transactional Email",
			subject:          "Welcome to WalletFlow newsletter!",
			body:             "Check out our new weekly features and saving tips.",
			expectedOk:       false,
			expectedMerchant: "",
			expectedAmount:   0.0,
			expectedCategory: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, ok := ParseEmail(tt.subject, tt.body, now)
			if ok != tt.expectedOk {
				t.Errorf("expected ok = %v, got %v", tt.expectedOk, ok)
				return
			}
			if ok {
				if res.Merchant != tt.expectedMerchant {
					t.Errorf("expected merchant = %q, got %q", tt.expectedMerchant, res.Merchant)
				}
				if res.Amount != tt.expectedAmount {
					t.Errorf("expected amount = %f, got %f", tt.expectedAmount, res.Amount)
				}
				if res.Category != tt.expectedCategory {
					t.Errorf("expected category = %q, got %q", tt.expectedCategory, res.Category)
				}
			}
		})
	}
}
