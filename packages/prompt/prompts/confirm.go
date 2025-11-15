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
	sl selector.Model
}

func (m confirmModel) Init() tea.Cmd {
	return nil
}

func (m *confirmModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg {
	case common.DONE:
		return m, tea.Quit
	}

	_, cmd := m.sl.Update(msg)
	return m, cmd
}

func (m confirmModel) View() string {
	return m.sl.View()
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

func Confirm(promptText, headerText, footerText string) string {
	const minTerminalHeight = 5

	// Check terminal height before starting
	fd := int(os.Stdout.Fd())
	_, height, err := term.GetSize(fd)
	if err != nil {
		result, _ := json.Marshal(&ConfirmResult{
			Confirmed: "",
			Error:     fmt.Sprintf("failed to get terminal size: %s", err),
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

	// Create Yes/No items
	data := []interface{}{
		ListItem{Value: "yes", Label: "Yes", Description: ""},
		ListItem{Value: "no", Label: "No", Description: ""},
	}

	header := headerText
	if header == "" {
		header = promptText
	}

	m := &confirmModel{
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

	p := tea.NewProgram(m)
	err = p.Start()
	if err != nil {
		result, _ := json.Marshal(&ConfirmResult{
			Confirmed: "",
			Error:     fmt.Sprintf("%s", err),
		})
		return string(result)
	}
	if !m.sl.Canceled() {
		selectedIndex := m.sl.Index()
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
