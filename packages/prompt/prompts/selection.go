package prompts

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/mritd/bubbles/common"

	"github.com/mritd/bubbles/selector"

	tea "github.com/charmbracelet/bubbletea"
	"golang.org/x/term"
)

type model struct {
	sl                    selector.Model
	items                 []ListItem
	ctrlCPressedOnce      bool
	ctrlCPressTime        time.Time
	showCancelMsg         bool
	canceled              bool
	autocompleteEnabled   bool
	autocompleteBuffer    string
	autocompleteLastInput time.Time
}

func (m model) Init() tea.Cmd {
	return nil
}

type resetCancelMsg struct{}

func (m *model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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
			return resetCancelMsg{}
		})
	}

	// Handle reset message
	if _, ok := msg.(resetCancelMsg); ok {
		// Reset cancel state after timeout
		m.ctrlCPressedOnce = false
		m.showCancelMsg = false
		return m, nil
	}

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
		if m.handleAutocompleteKey(msg) {
			return m, nil
		}
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
	view := m.sl.View()
	if m.showCancelMsg {
		view += "\n" + common.FontColor("Press Ctrl+C again to exit", "yellow")
	}
	return view
}

type ListItem struct {
	Value    string `json:"value"`
	Label    string `json:"label"`
	Hint     string `json:"hint"`
	Disabled bool   `json:"disabled"`
}

type Result struct {
	SelectedIndex string `json:"selectedIndex"`
	Error         string `json:"error"`
}

const autocompleteResetTimeout = 1500 * time.Millisecond

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

func (m *model) handleAutocompleteKey(msg tea.KeyMsg) bool {
	if !m.autocompleteEnabled || len(m.items) == 0 {
		return false
	}
	switch msg.Type {
	case tea.KeyRunes:
		if len(msg.Runes) == 0 {
			return false
		}
		if !m.autocompleteLastInput.IsZero() && time.Since(m.autocompleteLastInput) > autocompleteResetTimeout {
			m.autocompleteBuffer = ""
		}
		r := msg.Runes[0]
		if unicode.IsSpace(r) {
			return false
		}
		if unicode.IsDigit(r) && m.autocompleteBuffer == "" {
			return false
		}
		if !isAutocompleteRune(r) {
			return false
		}
		m.autocompleteLastInput = time.Now()
		m.autocompleteBuffer += strings.ToLower(string(msg.Runes))
		m.focusAutocompleteMatch()
		return true
	case tea.KeyBackspace:
		if m.autocompleteBuffer == "" {
			return false
		}
		m.autocompleteBuffer = trimLastRune(m.autocompleteBuffer)
		m.autocompleteLastInput = time.Now()
		if m.autocompleteBuffer == "" {
			return true
		}
		m.focusAutocompleteMatch()
		return true
	case tea.KeyEsc:
		if m.autocompleteBuffer == "" {
			return false
		}
		m.autocompleteBuffer = ""
		m.autocompleteLastInput = time.Time{}
		return true
	default:
		return false
	}
}

func (m *model) focusAutocompleteMatch() {
	if m.autocompleteBuffer == "" {
		return
	}
	idx := m.findAutocompleteMatch()
	if idx >= 0 {
		m.moveSelectorTo(idx)
	}
}

func (m *model) findAutocompleteMatch() int {
	if m.autocompleteBuffer == "" || len(m.items) == 0 {
		return -1
	}
	query := strings.ToLower(m.autocompleteBuffer)
	total := len(m.items)
	start := m.sl.Index()
	for offset := 0; offset < total; offset++ {
		idx := (start + offset) % total
		if idx < 0 || idx >= total {
			continue
		}
		item := m.items[idx]
		if item.Disabled {
			continue
		}
		label := strings.ToLower(item.Label)
		hint := strings.ToLower(item.Hint)
		value := strings.ToLower(item.Value)
		if strings.Contains(label, query) || (item.Hint != "" && strings.Contains(hint, query)) || strings.Contains(value, query) {
			return idx
		}
	}
	return -1
}

func (m *model) moveSelectorTo(target int) {
	if target < 0 || target >= len(m.items) {
		return
	}
	guard := 0
	for m.sl.Index() != target && guard < len(m.items)*2 {
		if m.sl.Index() < target {
			if !m.stepSelector(1) {
				break
			}
		} else {
			if !m.stepSelector(-1) {
				break
			}
		}
		guard++
	}
}

func (m *model) stepSelector(direction int) bool {
	key := tea.KeyMsg{Type: tea.KeyDown}
	if direction < 0 {
		key = tea.KeyMsg{Type: tea.KeyUp}
	}
	prev := m.sl.Index()
	m.sl.Update(key)
	if m.sl.Index() == prev {
		return false
	}
	for m.sl.Index() < len(m.items) && m.items[m.sl.Index()].Disabled {
		prev = m.sl.Index()
		m.sl.Update(key)
		if m.sl.Index() == prev {
			return false
		}
	}
	return true
}

func trimLastRune(value string) string {
	if value == "" {
		return value
	}
	_, size := utf8.DecodeLastRuneInString(value)
	if size <= 0 || size > len(value) {
		return ""
	}
	return value[:len(value)-size]
}

func isAutocompleteRune(r rune) bool {
	if unicode.IsLetter(r) {
		return true
	}
	if unicode.IsDigit(r) {
		return true
	}
	switch r {
	case '-', '_', '.', '/', '+', '#':
		return true
	default:
		return false
	}
}

func formatAutocompleteFooter(base, buffer string) string {
	hint := "Type to search"
	if buffer != "" {
		hint = fmt.Sprintf("Filter: %s", buffer)
	}
	base = strings.TrimSpace(base)
	if base == "" {
		return hint
	}
	return fmt.Sprintf("%s  |  %s", base, hint)
}

func Selection(jsonData, headerText, footerText string, perPage int, autocomplete bool, defaultValue, initialValue string) string {
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
		data = append(data, ListItem{Value: val.Value, Label: val.Label, Hint: val.Hint, Disabled: val.Disabled})
	}

	// Determine start index based on initialValue or defaultValue
	startIndex := 0

	// If initialValue is provided, find the matching item
	if initialValue != "" {
		for i, it := range item {
			if it.Value == initialValue && !it.Disabled {
				startIndex = i
				break
			}
		}
	} else if defaultValue != "" {
		// If no initialValue but defaultValue is provided, use it
		for i, it := range item {
			if it.Value == defaultValue && !it.Disabled {
				startIndex = i
				break
			}
		}
	} else {
		// Otherwise, find first non-disabled item
		for startIndex < len(item) && item[startIndex].Disabled {
			startIndex++
		}
		if startIndex >= len(item) {
			startIndex = 0
		}
	}

	sl := selector.Model{
		Data:       data,
		PerPage:    perPage,
		HeaderFunc: selector.DefaultHeaderFuncWithAppend(headerText),
		SelectedFunc: func(sl selector.Model, obj interface{}, gdIndex int) string {
			t := obj.(ListItem)
			disabled := t.Disabled
			if gdIndex < len(item) {
				disabled = item[gdIndex].Disabled
			}
			if disabled {
				if t.Hint != "" {
					return common.FontColor(fmt.Sprintf("[%d] %s (%s) (disabled)", gdIndex+1, t.Label, t.Hint), "240")
				}
				return common.FontColor(fmt.Sprintf("[%d] %s (disabled)", gdIndex+1, t.Label), "240")
			}
			if t.Hint != "" {
				return common.FontColor(fmt.Sprintf("[%d] %s (%s)", gdIndex+1, t.Label, t.Hint), selector.ColorSelected)
			}
			return common.FontColor(fmt.Sprintf("[%d] %s", gdIndex+1, t.Label), selector.ColorSelected)
		},
		UnSelectedFunc: func(sl selector.Model, obj interface{}, gdIndex int) string {
			t := obj.(ListItem)
			disabled := t.Disabled
			if gdIndex < len(item) {
				disabled = item[gdIndex].Disabled
			}
			if disabled {
				return common.FontColor(fmt.Sprintf(" %d. %s (disabled)", gdIndex+1, t.Label), "240")
			}
			return common.FontColor(fmt.Sprintf(" %d. %s", gdIndex+1, t.Label), selector.ColorUnSelected)
		},
		FooterFunc: func(sl selector.Model, obj interface{}, gdIndex int) string {
			return common.FontColor(footerText, selector.ColorFooter)
		},
		FinishedFunc: func(s interface{}) string {
			return ""
		},
	}

	m := &model{
		items:               item,
		ctrlCPressedOnce:    false,
		showCancelMsg:       false,
		canceled:            false,
		autocompleteEnabled: autocomplete,
		autocompleteBuffer:  "",
		sl:                  sl,
	}

	m.sl.FooterFunc = func(sl selector.Model, obj interface{}, gdIndex int) string {
		if !m.autocompleteEnabled {
			return common.FontColor(footerText, selector.ColorFooter)
		}
		return common.FontColor(formatAutocompleteFooter(footerText, m.autocompleteBuffer), selector.ColorFooter)
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
	if !m.canceled && !m.sl.Canceled() {
		selectedIndex := m.sl.Index()
		// Ensure we didn't select a disabled item
		if selectedIndex < len(m.items) && m.items[selectedIndex].Disabled {
			result, _ := json.Marshal(&Result{
				SelectedIndex: "",
				Error:         "Cannot select disabled item",
			})
			return string(result)
		}
		// If user didn't change selection from initial position and defaultValue is provided, use it
		if defaultValue != "" && selectedIndex == startIndex {
			selectedValue := m.items[selectedIndex].Value
			// If defaultValue is different from what's currently selected, find and use it
			if defaultValue != selectedValue {
				// Find defaultValue in items
				for i, it := range m.items {
					if it.Value == defaultValue && !it.Disabled {
						selectedIndex = i
						break
					}
				}
			}
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
