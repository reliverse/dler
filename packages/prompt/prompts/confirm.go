package prompts

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/mritd/bubbles/common"

	"github.com/mritd/bubbles/selector"

	tea "github.com/charmbracelet/bubbletea"
	"golang.org/x/term"
)

type confirmModel struct {
	sl               selector.Model
	ctrlCPressedOnce bool
	ctrlCPressTime   time.Time
	showCancelMsg    bool
	canceled         bool
}

func (m confirmModel) Init() tea.Cmd {
	return nil
}

type confirmResetCancelMsg struct{}

func (m *confirmModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// Handle double Ctrl+C first - must intercept before selector sees it
	if keyMsg, ok := msg.(tea.KeyMsg); ok && keyMsg.String() == "ctrl+c" {
		now := time.Now()
		if m.ctrlCPressedOnce && now.Sub(m.ctrlCPressTime) < 2*time.Second {
			// Second Ctrl+C within 2 seconds - actually cancel
			m.canceled = true
			return m, tea.Quit
		}
		// First Ctrl+C - show message and set timer
		// IMPORTANT: Don't pass this to selector, return early
		m.ctrlCPressedOnce = true
		m.ctrlCPressTime = now
		m.showCancelMsg = true
		// Reset after 2 seconds
		return m, tea.Tick(2*time.Second, func(t time.Time) tea.Msg {
			return confirmResetCancelMsg{}
		})
	}

	// Handle reset message
	if _, ok := msg.(confirmResetCancelMsg); ok {
		// Reset cancel state after timeout
		m.ctrlCPressedOnce = false
		m.showCancelMsg = false
		return m, nil
	}

	switch msg {
	case common.DONE:
		return m, tea.Quit
	}

	_, cmd := m.sl.Update(msg)
	return m, cmd
}

func (m confirmModel) View() string {
	view := m.sl.View()
	if m.showCancelMsg {
		view += "\n" + common.FontColor("Press Ctrl+C again to exit", "yellow")
	}
	return view
}

type ConfirmResult struct {
	Confirmed string `json:"confirmed"`
	Error     string `json:"error"`
}

type confirmWaitForResizeModel struct {
	minHeight int
	message   string
}

func (m confirmWaitForResizeModel) Init() tea.Cmd {
	return tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
		return confirmCheckTerminalSizeMsg{}
	})
}

type confirmCheckTerminalSizeMsg struct{}

func (m confirmWaitForResizeModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		if msg.Height >= m.minHeight {
			return m, tea.Quit
		}
		return m, tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
			return confirmCheckTerminalSizeMsg{}
		})
	case confirmCheckTerminalSizeMsg:
		fd := int(os.Stdout.Fd())
		_, height, err := term.GetSize(fd)
		if err == nil && height >= m.minHeight {
			return m, tea.Quit
		}
		return m, tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
			return confirmCheckTerminalSizeMsg{}
		})
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m confirmWaitForResizeModel) View() string {
	fd := int(os.Stdout.Fd())
	_, height, err := term.GetSize(fd)
	if err != nil {
		return fmt.Sprintf("Error checking terminal size: %s\n", err)
	}
	return fmt.Sprintf("\n%s\n\nCurrent height: %d | Required: %d\n\nPlease resize your terminal window to continue...\n", m.message, height, m.minHeight)
}

func confirmWaitForTerminalResize(minHeight int, message string) error {
	m := confirmWaitForResizeModel{
		minHeight: minHeight,
		message:   message,
	}
	p := tea.NewProgram(m, tea.WithAltScreen())
	err := p.Start()
	if err != nil {
		return err
	}

	// Block until terminal is large enough
	fd := int(os.Stdout.Fd())
	for {
		_, height, err := term.GetSize(fd)
		if err == nil && height >= minHeight {
			break
		}
		time.Sleep(time.Second / 2)
	}
	return nil
}

func Confirm(promptText, headerText, footerText string, defaultValue, initialValue string) string {
	const minTerminalHeight = 5

	var err error

	if shouldValidateTerminalSize() {
		height, sizeErr := getTerminalHeight()
		if sizeErr != nil {
			result, _ := json.Marshal(&ConfirmResult{
				Confirmed: "",
				Error:     fmt.Sprintf("failed to get terminal size: %s", sizeErr),
			})
			return string(result)
		}

		if height < minTerminalHeight {
			// Wait for user to resize terminal instead of returning error
			waitMessage := fmt.Sprintf("⚠️  Terminal height too small!\n   Current: %d lines | Required: %d lines", height, minTerminalHeight)
			err = confirmWaitForTerminalResize(minTerminalHeight, waitMessage)
			if err != nil {
				result, _ := json.Marshal(&ConfirmResult{
					Confirmed: "",
					Error:     fmt.Sprintf("failed to wait for terminal resize: %s", err),
				})
				return string(result)
			}
		}
	}

	// Create Yes/No items
	data := []interface{}{
		ListItem{Value: "yes", Label: "Yes", Hint: ""},
		ListItem{Value: "no", Label: "No", Hint: ""},
	}

	header := headerText
	if header == "" {
		header = promptText
	}

	// Determine start index based on initialValue or defaultValue
	startIndex := 0
	if initialValue == "true" {
		startIndex = 0 // Yes
	} else if initialValue == "false" {
		startIndex = 1 // No
	} else if defaultValue == "true" {
		startIndex = 0 // Yes
	} else if defaultValue == "false" {
		startIndex = 1 // No
	}

	m := &confirmModel{
		ctrlCPressedOnce: false,
		showCancelMsg:    false,
		canceled:         false,
		sl: selector.Model{
			Data:       data,
			PerPage:    2,
			HeaderFunc: selector.DefaultHeaderFuncWithAppend(header),
			SelectedFunc: func(m selector.Model, obj interface{}, gdIndex int) string {
				t := obj.(ListItem)
				return common.FontColor(fmt.Sprintf("[%d] %s", gdIndex+1, t.Label), selector.ColorSelected)
			},
			UnSelectedFunc: func(m selector.Model, obj interface{}, gdIndex int) string {
				t := obj.(ListItem)
				return common.FontColor(fmt.Sprintf(" %d. %s", gdIndex+1, t.Label), selector.ColorUnSelected)
			},
			FooterFunc: func(m selector.Model, obj interface{}, gdIndex int) string {
				footer := footerText
				if footer == "" {
					footer = "Use arrow keys to navigate, Enter to confirm"
				}
				return common.FontColor(footer, selector.ColorFooter)
			},
			FinishedFunc: func(s interface{}) string {
				return ""
			},
		},
	}

	// Set initial index
	if startIndex > 0 {
		for i := 0; i < startIndex; i++ {
			m.sl.Update(tea.KeyMsg{Type: tea.KeyDown})
		}
	}

	p := tea.NewProgram(m)
	err = p.Start()
	if err != nil {
		result, _ := json.Marshal(&ConfirmResult{
			Confirmed: "",
			Error:     fmt.Sprintf("%s", err),
		})
		return string(result)
	}
	if !m.canceled && !m.sl.Canceled() {
		selectedIndex := m.sl.Index()
		// If user didn't change selection from initial position and defaultValue is provided, use it
		if defaultValue != "" && selectedIndex == startIndex {
			// Use defaultValue
			result, _ := json.Marshal(&ConfirmResult{
				Confirmed: defaultValue,
				Error:     "",
			})
			return string(result)
		}
		// Index 0 = Yes, Index 1 = No
		confirmed := "false"
		if selectedIndex == 0 {
			confirmed = "true"
		}
		result, _ := json.Marshal(&ConfirmResult{
			Confirmed: confirmed,
			Error:     "",
		})
		return string(result)
	}
	result, _ := json.Marshal(&ConfirmResult{
		Confirmed: "",
		Error:     "Cancelled",
	})
	return string(result)
}
