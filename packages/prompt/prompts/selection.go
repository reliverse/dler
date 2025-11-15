package prompts

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/mritd/bubbles/common"

	"github.com/mritd/bubbles/selector"

	tea "github.com/charmbracelet/bubbletea"
	"golang.org/x/term"
)

type model struct {
	sl    selector.Model
	items []ListItem
}

func (m model) Init() tea.Cmd {
	return nil
}
func (m *model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// By default, the prompt component will not return a "tea.Quit"
	// message unless Ctrl+C is pressed.
	//
	// If there is no error in the input, the prompt component returns
	// a "common.DONE" message when the Enter key is pressed.
	switch msg {
	case common.DONE:
		// Check if current item is disabled, if so, don't allow selection
		currentIndex := m.sl.Index()
		if currentIndex < len(m.items) && m.items[currentIndex].Disabled {
			return m, nil
		}
		return m, tea.Quit
	}

	// Handle navigation - skip disabled items
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			// Move up, skipping disabled items
			_, cmd := m.sl.Update(msg)
			// After update, check if we're on a disabled item and skip if needed
			for m.sl.Index() < len(m.items) && m.items[m.sl.Index()].Disabled {
				_, cmd = m.sl.Update(tea.KeyMsg{Type: tea.KeyUp})
			}
			return m, cmd
		case "down", "j":
			// Move down, skipping disabled items
			_, cmd := m.sl.Update(msg)
			// After update, check if we're on a disabled item and skip if needed
			for m.sl.Index() < len(m.items) && m.items[m.sl.Index()].Disabled {
				_, cmd = m.sl.Update(tea.KeyMsg{Type: tea.KeyDown})
			}
			return m, cmd
		}
	}

	_, cmd := m.sl.Update(msg)
	return m, cmd
}

func (m model) View() string {
	return m.sl.View()
}

type ListItem struct {
	Value       string `json:"value"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Disabled    bool   `json:"disabled"`
}

type Result struct {
	SelectedIndex string `json:"selectedIndex"`
	Error         string `json:"error"`
}

type waitForResizeModel struct {
	minHeight int
	message   string
}

func (m waitForResizeModel) Init() tea.Cmd {
	return tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
		return checkTerminalSizeMsg{}
	})
}

type checkTerminalSizeMsg struct{}

func (m waitForResizeModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		if msg.Height >= m.minHeight {
			return m, tea.Quit
		}
		return m, tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
			return checkTerminalSizeMsg{}
		})
	case checkTerminalSizeMsg:
		fd := int(os.Stdout.Fd())
		_, height, err := term.GetSize(fd)
		if err == nil && height >= m.minHeight {
			return m, tea.Quit
		}
		return m, tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
			return checkTerminalSizeMsg{}
		})
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m waitForResizeModel) View() string {
	fd := int(os.Stdout.Fd())
	_, height, err := term.GetSize(fd)
	if err != nil {
		return fmt.Sprintf("Error checking terminal size: %s\n", err)
	}
	return fmt.Sprintf("\n%s\n\nCurrent height: %d | Required: %d\n\nPlease resize your terminal window to continue...\n", m.message, height, m.minHeight)
}

func waitForTerminalResize(minHeight int, message string) error {
	m := waitForResizeModel{
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

func Selection(jsonData, headerText, footerText string, perPage int) string {
	// Minimum height: header (1) + perPage items + footer (1) + buffer (2) = perPage + 4
	minTerminalHeight := perPage + 4
	if minTerminalHeight < 5 {
		minTerminalHeight = 5
	}

	// Check terminal height before starting
	fd := int(os.Stdout.Fd())
	_, height, err := term.GetSize(fd)
	if err != nil {
		result, _ := json.Marshal(&Result{
			SelectedIndex: "",
			Error:         fmt.Sprintf("failed to get terminal size: %s", err),
		})
		return string(result)
	}

	if height < minTerminalHeight {
		// Wait for user to resize terminal instead of returning error
		waitMessage := fmt.Sprintf("⚠️  Terminal height too small!\n   Current: %d lines | Required: %d lines (for perPage=%d)", height, minTerminalHeight, perPage)
		err = waitForTerminalResize(minTerminalHeight, waitMessage)
		if err != nil {
			result, _ := json.Marshal(&Result{
				SelectedIndex: "",
				Error:         fmt.Sprintf("failed to wait for terminal resize: %s", err),
			})
			return string(result)
		}
	}

	var item []ListItem
	json.Unmarshal([]byte(jsonData), &item)
	data := []interface{}{}
	for _, val := range item {
		data = append(data, ListItem{Value: val.Value, Label: val.Label, Description: val.Description, Disabled: val.Disabled})
	}

	// Find first non-disabled item to start on
	startIndex := 0
	for startIndex < len(item) && item[startIndex].Disabled {
		startIndex++
	}
	if startIndex >= len(item) {
		startIndex = 0
	}

	m := &model{
		items: item,
		sl: selector.Model{
			Data:    data,
			PerPage: perPage,
			// Use the arrow keys to navigate: ↓ ↑ → ←
			// Select Commit Type:
			HeaderFunc: selector.DefaultHeaderFuncWithAppend(headerText),
			// [1] feat (Introducing new features)
			SelectedFunc: func(sl selector.Model, obj interface{}, gdIndex int) string {
				t := obj.(ListItem)
				disabled := t.Disabled
				if gdIndex < len(item) {
					disabled = item[gdIndex].Disabled
				}
				if disabled {
					if t.Description != "" {
						return common.FontColor(fmt.Sprintf("[%d] %s (%s) (disabled)", gdIndex+1, t.Label, t.Description), "240")
					}
					return common.FontColor(fmt.Sprintf("[%d] %s (disabled)", gdIndex+1, t.Label), "240")
				}
				if t.Description != "" {
					return common.FontColor(fmt.Sprintf("[%d] %s (%s)", gdIndex+1, t.Label, t.Description), selector.ColorSelected)
				}
				return common.FontColor(fmt.Sprintf("[%d] %s", gdIndex+1, t.Label), selector.ColorSelected)
			},
			// 2. fix (Bug fix)
			UnSelectedFunc: func(sl selector.Model, obj interface{}, gdIndex int) string {
				t := obj.(ListItem)
				disabled := t.Disabled
				if gdIndex < len(item) {
					disabled = item[gdIndex].Disabled
				}
				if disabled {
					if t.Description != "" {
						return common.FontColor(fmt.Sprintf(" %d. %s (%s) (disabled)", gdIndex+1, t.Label, t.Description), "240")
					}
					return common.FontColor(fmt.Sprintf(" %d. %s (disabled)", gdIndex+1, t.Label), "240")
				}
				if t.Description != "" {
					return common.FontColor(fmt.Sprintf(" %d. %s (%s)", gdIndex+1, t.Label, t.Description), selector.ColorUnSelected)
				}
				return common.FontColor(fmt.Sprintf(" %d. %s", gdIndex+1, t.Label), selector.ColorUnSelected)
			},
			FooterFunc: func(sl selector.Model, obj interface{}, gdIndex int) string {
				return common.FontColor(footerText, selector.ColorFooter)
			},
			FinishedFunc: func(s interface{}) string {
				return ""
			},
		},
	}

	// Set initial index to first non-disabled item
	if startIndex > 0 {
		for i := 0; i < startIndex; i++ {
			m.sl.Update(tea.KeyMsg{Type: tea.KeyDown})
		}
	}

	p := tea.NewProgram(m)
	err = p.Start()
	if err != nil {
		result, _ := json.Marshal(&Result{
			SelectedIndex: "",
			Error:         fmt.Sprintf("%s", err),
		})
		return string(result)
	}
	if !m.sl.Canceled() {
		selectedIndex := m.sl.Index()
		// Ensure we didn't select a disabled item
		if selectedIndex < len(m.items) && m.items[selectedIndex].Disabled {
			result, _ := json.Marshal(&Result{
				SelectedIndex: "",
				Error:         "Cannot select disabled item",
			})
			return string(result)
		}
		result, _ := json.Marshal(&Result{
			SelectedIndex: strconv.Itoa(selectedIndex),
			Error:         "",
		})
		return string(result)
	} else {
		result, _ := json.Marshal(&Result{
			SelectedIndex: "",
			Error:         "Cancelled",
		})
		return string(result)
	}
}
