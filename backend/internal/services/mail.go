package services

import (
	"io"
	"log"
	"net"
	"strconv"
	"time"

	"expense-manager/backend/internal/config"
	"expense-manager/backend/internal/models"
	"expense-manager/backend/internal/parser"

	"github.com/emersion/go-imap"
	"github.com/emersion/go-imap/client"
)

// FetchAndParseEmails connects to the user's IMAP server, checks for unread emails, parses them, and records transactions.
func FetchAndParseEmails(userID uint, mailConfig models.MailConfig) (int, error) {
	addr := net.JoinHostPort(mailConfig.IMAPServer, strconv.Itoa(mailConfig.IMAPPort))

	// Connect to IMAP server (SSL/TLS)
	c, err := client.DialTLS(addr, nil)
	if err != nil {
		log.Printf("IMAP Dial error for %s: %v", mailConfig.Email, err)
		return 0, err
	}
	defer c.Logout()

	// Login
	if err := c.Login(mailConfig.Email, mailConfig.Password); err != nil {
		log.Printf("IMAP Login failed for %s: %v", mailConfig.Email, err)
		return 0, err
	}

	// Select INBOX
	mbox, err := c.Select("INBOX", false)
	if err != nil {
		log.Printf("IMAP Select INBOX failed for %s: %v", mailConfig.Email, err)
		return 0, err
	}

	if mbox.Messages == 0 {
		return 0, nil
	}

	// Search for UNSEEN messages
	criteria := imap.NewSearchCriteria()
	criteria.WithoutFlags = []string{imap.SeenFlag}
	uids, err := c.Search(criteria)
	if err != nil {
		log.Printf("IMAP Search unseen failed for %s: %v", mailConfig.Email, err)
		return 0, err
	}

	if len(uids) == 0 {
		return 0, nil
	}

	seqset := new(imap.SeqSet)
	seqset.AddNum(uids...)

	// Get envelope and body text
	var section imap.BodySectionName
	items := []imap.FetchItem{imap.FetchEnvelope, section.FetchItem()}

	messages := make(chan *imap.Message, 10)
	done := make(chan error, 1)
	go func() {
		done <- c.Fetch(seqset, items, messages)
	}()

	addedCount := 0

	for msg := range messages {
		// Read body
		r := msg.GetBody(&section)
		if r == nil {
			continue
		}

		bodyBytes, err := io.ReadAll(r)
		if err != nil {
			log.Printf("Error reading email body: %v", err)
			continue
		}

		subject := ""
		receivedTime := time.Now()
		if msg.Envelope != nil {
			subject = msg.Envelope.Subject
			receivedTime = msg.Envelope.Date
		}

		bodyStr := string(bodyBytes)

		// Parse the email
		if parsed, ok := parser.ParseEmail(subject, bodyStr, receivedTime); ok {
			// Save transaction to DB
			transaction := models.Transaction{
				UserID:      userID,
				Title:       parsed.Merchant,
				Amount:      parsed.Amount,
				Category:    parsed.Category,
				Type:        "expense",
				Date:        parsed.Date,
				Source:      "email",
				IsRecurring: false,
			}

			// Check for duplicate to avoid double insertion if IMAP Seen flag sync delays
			var existing models.Transaction
			err := config.DB.Where("user_id = ? AND title = ? AND amount = ? AND date = ? AND source = 'email'", 
				userID, transaction.Title, transaction.Amount, transaction.Date).First(&existing).Error
			if err != nil { // If record not found, create it
				if err := config.DB.Create(&transaction).Error; err == nil {
					addedCount++
					log.Printf("Auto-added expense from mail: %s - Rs. %.2f", transaction.Title, transaction.Amount)

					// Trigger Push Notification
					SendNotification(
						userID,
						"New Expense Fetched from Email",
						"Added Rs. "+strconv.FormatFloat(transaction.Amount, 'f', 2, 64)+" at "+transaction.Title,
						"/dashboard",
					)
				}
			}
		}

		// Mark email as read
		item := imap.FormatFlagsOp(imap.AddFlags, true)
		flags := []interface{}{imap.SeenFlag}
		singleSeqSet := new(imap.SeqSet)
		singleSeqSet.AddNum(msg.SeqNum)
		_ = c.Store(singleSeqSet, item, flags, nil)
	}

	if err := <-done; err != nil {
		log.Printf("IMAP Fetch failed: %v", err)
		return addedCount, err
	}

	return addedCount, nil
}
