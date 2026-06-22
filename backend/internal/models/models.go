package models

import (
	"time"
)

// User represents an application user.
type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"uniqueIndex;not null" json:"username"`
	PasswordHash string    `gorm:"not null" json:"-"`
	Email        string    `gorm:"not null" json:"email"`
	Role         string    `gorm:"type:varchar(20);default:'user';not null" json:"role"` // 'admin' or 'user'
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Transaction represents a financial record, either an expense or an income/salary.
type Transaction struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	UserID          uint           `gorm:"not null;index" json:"user_id"`
	User            *User          `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	Title           string         `gorm:"not null" json:"title"`
	Amount          float64        `gorm:"type:decimal(10,2);not null" json:"amount"`
	Category        string         `gorm:"type:varchar(50);not null" json:"category"` // "Food", "Salary", "Utilities", "Travel", "Loan", etc.
	Type            string         `gorm:"type:varchar(10);not null" json:"type"`     // "expense" or "income"
	Date            time.Time      `gorm:"not null;index" json:"date"`
	Source          string         `gorm:"type:varchar(20);default:'manual';not null" json:"source"` // "manual", "email", "bill_scan", "auto"
	IsRecurring     bool           `gorm:"default:false;not null" json:"is_recurring"`
	RecurringRuleID *uint          `gorm:"index" json:"recurring_rule_id,omitempty"`
	RecurringRule   *RecurringRule `gorm:"foreignKey:RecurringRuleID;constraint:OnDelete:SET NULL" json:"recurring_rule,omitempty"`
	CreatedAt       time.Time      `json:"created_at"`
}

// RecurringRule represents a schedule for adding automated transactions (e.g., salary, monthly rent, loan EMIs).
type RecurringRule struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	User      *User     `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	Title     string    `gorm:"not null" json:"title"`
	Amount    float64   `gorm:"type:decimal(10,2);not null" json:"amount"`
	Category  string    `gorm:"type:varchar(50);not null" json:"category"`
	Type      string    `gorm:"type:varchar(10);not null" json:"type"`          // "expense" or "income"
	Frequency string    `gorm:"type:varchar(20);default:'monthly';not null" json:"frequency"` // "daily", "weekly", "monthly", "yearly"
	LastRun   time.Time `gorm:"index" json:"last_run"`
	IsActive  bool      `gorm:"default:true;not null" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// PushSubscription stores subscription details for Web Push notifications.
type PushSubscription struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	User      *User     `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	Endpoint  string    `gorm:"uniqueIndex;not null" json:"endpoint"`
	P256dh    string    `gorm:"not null" json:"p256dh"`
	Auth      string    `gorm:"not null" json:"auth"`
	CreatedAt time.Time `json:"created_at"`
}

// MailConfig stores the IMAP email credentials of a user to scan for expense updates.
type MailConfig struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     uint      `gorm:"not null;index" json:"user_id"`
	User       *User     `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	IMAPServer string    `gorm:"not null" json:"imap_server"`
	IMAPPort   int       `gorm:"default:993;not null" json:"imap_port"`
	Email      string    `gorm:"not null" json:"email"`
	Password   string    `gorm:"not null" json:"password"` // Encrypted or plain App Password
	IsActive   bool      `gorm:"default:true;not null" json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
}
