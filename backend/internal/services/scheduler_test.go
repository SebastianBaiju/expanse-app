package services

import (
	"testing"
	"time"

	"expense-manager/backend/internal/models"
)

func TestIsRuleDue(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name        string
		frequency   string
		lastRun     time.Time
		expectedDue bool
	}{
		{
			name:        "Never Run Rule is Due",
			frequency:   "monthly",
			lastRun:     time.Time{},
			expectedDue: true,
		},
		{
			name:        "Daily Rule - 25 hours ago is Due",
			frequency:   "daily",
			lastRun:     now.Add(-25 * time.Hour),
			expectedDue: true,
		},
		{
			name:        "Daily Rule - 10 hours ago is NOT Due",
			frequency:   "daily",
			lastRun:     now.Add(-10 * time.Hour),
			expectedDue: false,
		},
		{
			name:        "Weekly Rule - 8 days ago is Due",
			frequency:   "weekly",
			lastRun:     now.Add(-8 * 24 * time.Hour),
			expectedDue: true,
		},
		{
			name:        "Weekly Rule - 3 days ago is NOT Due",
			frequency:   "weekly",
			lastRun:     now.Add(-3 * 24 * time.Hour),
			expectedDue: false,
		},
		{
			name:        "Monthly Rule - Previous Month is Due",
			frequency:   "monthly",
			lastRun:     time.Date(2026, 5, 20, 12, 0, 0, 0, time.UTC),
			expectedDue: true,
		},
		{
			name:        "Monthly Rule - Current Month is NOT Due",
			frequency:   "monthly",
			lastRun:     time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC),
			expectedDue: false,
		},
		{
			name:        "Yearly Rule - Previous Year is Due",
			frequency:   "yearly",
			lastRun:     time.Date(2025, 12, 31, 12, 0, 0, 0, time.UTC),
			expectedDue: true,
		},
		{
			name:        "Yearly Rule - Current Year is NOT Due",
			frequency:   "yearly",
			lastRun:     time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC),
			expectedDue: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := models.RecurringRule{
				Frequency: tt.frequency,
				LastRun:   tt.lastRun,
			}
			got := IsRuleDue(rule, now)
			if got != tt.expectedDue {
				t.Errorf("expected due = %v, got %v for lastRun %s with frequency %s", tt.expectedDue, got, tt.lastRun, tt.frequency)
			}
		})
	}
}
