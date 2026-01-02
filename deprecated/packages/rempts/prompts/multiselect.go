package prompts

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
	"unicode"

	"github.com/mritd/bubbles/common"

	"github.com/mritd/bubbles/selector"

	tea "github.com/charmbracelet/bubbletea"
	"golang.org/x/term"
)

type multiselectModel struct {
	sl                    selector.Model
	selected              map[int]bool
	items                 []ListItem
	headerText            string
	footerText            string
	canceled              bool
	ctrlCPressedOnce      bool
	ctrlCPressTime        time.Time
	showCancelMsg         bool
	autocompleteEnabled   bool
	autocompleteBuffer    string
	autocompleteLastInput time.Time
}

func (m multiselectModel) Init() tea.Cmd {
	return nil
}

type multiselectResetCancelMsg struct{}

func (m *multiselectModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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
			return multiselectResetCancelMsg{}
		})
	}

	// Handle reset message
	if _, ok := msg.(multiselectResetCancelMsg); ok {
		// Reset cancel state after timeout
		m.ctrlCPressedOnce = false
		m.showCancelMsg = false
		return m, nil
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.handleAutocompleteKey(msg) {
			return m, nil
		}
		switch msg.String() {
		case " ":
			// Toggle selection on space
			currentIndex := m.sl.Index()
			// Prevent toggling disabled items
			if currentIndex < len(m.items) && m.items[currentIndex].Disabled {
				return m, nil
			}
			if m.selected[currentIndex] {
				delete(m.selected, currentIndex)
			} else {
				m.selected[currentIndex] = true
			}
			// Don't pass space to selector, just update our selection state
			return m, nil
		case "enter":
			// Confirm selection
			return m, tea.Quit
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

func (m multiselectModel) View() string {
	view := m.sl.View()
	if m.showCancelMsg {
		view += "\n" + common.FontColor("Press Ctrl+C again to exit", "yellow")
	}
	return view
}

type MultiselectResult struct {
	SelectedIndices []string `json:"selectedIndices"`
	Error           string   `json:"error"`
}

type multiselectWaitForResizeModel struct {
	minHeight int
	message   string
}

func (m multiselectWaitForResizeModel) Init() tea.Cmd {
	return tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
		return multiselectCheckTerminalSizeMsg{}
	})
}

type multiselectCheckTerminalSizeMsg struct{}

func (m multiselectWaitForResizeModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		if msg.Height >= m.minHeight {
			return m, tea.Quit
		}
		return m, tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
			return multiselectCheckTerminalSizeMsg{}
		})
	case multiselectCheckTerminalSizeMsg:
		fd := int(os.Stdout.Fd())
		_, height, err := term.GetSize(fd)
		if err == nil && height >= m.minHeight {
			return m, tea.Quit
		}
		return m, tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
			return multiselectCheckTerminalSizeMsg{}
		})
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m multiselectWaitForResizeModel) View() string {
	fd := int(os.Stdout.Fd())
	_, height, err := term.GetSize(fd)
	if err != nil {
		return fmt.Sprintf("Error checking terminal size: %s\n", err)
	}
	return fmt.Sprintf("\n%s\n\nCurrent height: %d | Required: %d\n\nPlease resize your terminal window to continue...\n", m.message, height, m.minHeight)
}

func multiselectWaitForTerminalResize(minHeight int, message string) error {
	m := multiselectWaitForResizeModel{
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

func (m *multiselectModel) handleAutocompleteKey(msg tea.KeyMsg) bool {
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

func (m *multiselectModel) focusAutocompleteMatch() {
	if m.autocompleteBuffer == "" {
		return
	}
	idx := m.findAutocompleteMatch()
	if idx >= 0 {
		m.moveSelectorTo(idx)
	}
}

func (m *multiselectModel) findAutocompleteMatch() int {
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

func (m *multiselectModel) moveSelectorTo(target int) {
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

func (m *multiselectModel) stepSelector(direction int) bool {
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

func Multiselect(jsonData, headerText, footerText string, perPage int, autocomplete bool, preselectedValues, initialCursorValue string) string {
	// Minimum height: header (1) + perPage items + footer (1) + buffer (2) = perPage + 4
	minTerminalHeight := perPage + 4
	if minTerminalHeight < 5 {
		minTerminalHeight = 5
	}

	var err error

	if shouldValidateTerminalSize() {
		height, sizeErr := getTerminalHeight()
		if sizeErr != nil {
			result, _ := json.Marshal(&MultiselectResult{
				SelectedIndices: []string{},
				Error:           fmt.Sprintf("failed to get terminal size: %s", sizeErr),
			})
			return string(result)
		}

		if height < minTerminalHeight {
			// Wait for user to resize terminal instead of returning error
			waitMessage := fmt.Sprintf("⚠️  Terminal height too small!\n   Current: %d lines | Required: %d lines (for perPage=%d)", height, minTerminalHeight, perPage)
			err = multiselectWaitForTerminalResize(minTerminalHeight, waitMessage)
			if err != nil {
				result, _ := json.Marshal(&MultiselectResult{
					SelectedIndices: []string{},
					Error:           fmt.Sprintf("failed to wait for terminal resize: %s", err),
				})
				return string(result)
			}
		}
	}

	var item []ListItem
	json.Unmarshal([]byte(jsonData), &item)
	data := []interface{}{}
	for _, val := range item {
		data = append(data, ListItem{Value: val.Value, Label: val.Label, Hint: val.Hint, Disabled: val.Disabled})
	}

	// Parse preselectedValues (JSON array of strings) - used for preselection
	preselectedSet := make(map[string]bool)
	if preselectedValues != "" {
		var preselectedVals []string
		json.Unmarshal([]byte(preselectedValues), &preselectedVals)
		for _, val := range preselectedVals {
			preselectedSet[val] = true
		}
	}

	// Determine start index based on initialCursorValue (first preselected value or empty)
	startIndex := 0
	if initialCursorValue != "" {
		for i, it := range item {
			if it.Value == initialCursorValue && !it.Disabled {
				startIndex = i
				break
			}
		}
	} else {
		// Find first non-disabled item to start on
		for startIndex < len(item) && item[startIndex].Disabled {
			startIndex++
		}
		if startIndex >= len(item) {
			startIndex = 0
		}
	}

	selected := make(map[int]bool)
	// Set initial selections based on preselectedValues (acts as preselection)
	for i, it := range item {
		if !it.Disabled && preselectedSet[it.Value] {
			selected[i] = true
		}
	}
	sl := selector.Model{
		Data:    data,
		PerPage: perPage,
		HeaderFunc: func(sl selector.Model, obj interface{}, gdIndex int) string {
			selectedCount := 0
			for range selected {
				selectedCount++
			}
			header := headerText
			if selectedCount > 0 {
				header = fmt.Sprintf("%s (%d selected)", headerText, selectedCount)
			}
			return selector.DefaultHeaderFuncWithAppend(header)(sl, obj, gdIndex)
		},
		SelectedFunc: func(sl selector.Model, obj interface{}, gdIndex int) string {
			t := obj.(ListItem)
			disabled := t.Disabled
			if gdIndex < len(item) {
				disabled = item[gdIndex].Disabled
			}
			prefix := " "
			if selected[gdIndex] {
				prefix = "✓"
			}
			if disabled {
				if t.Hint != "" {
					return common.FontColor(fmt.Sprintf("%s [%d] %s (%s) (disabled)", prefix, gdIndex+1, t.Label, t.Hint), "240")
				}
				return common.FontColor(fmt.Sprintf("%s [%d] %s (disabled)", prefix, gdIndex+1, t.Label), "240")
			}
			if t.Hint != "" {
				return common.FontColor(fmt.Sprintf("%s [%d] %s (%s)", prefix, gdIndex+1, t.Label, t.Hint), selector.ColorSelected)
			}
			return common.FontColor(fmt.Sprintf("%s [%d] %s", prefix, gdIndex+1, t.Label), selector.ColorSelected)
		},
		UnSelectedFunc: func(sl selector.Model, obj interface{}, gdIndex int) string {
			t := obj.(ListItem)
			disabled := t.Disabled
			if gdIndex < len(item) {
				disabled = item[gdIndex].Disabled
			}
			prefix := " "
			if selected[gdIndex] {
				prefix = "✓"
			}
			if disabled {
				return common.FontColor(fmt.Sprintf("%s  %d. %s (disabled)", prefix, gdIndex+1, t.Label), "240")
			}
			return common.FontColor(fmt.Sprintf("%s  %d. %s", prefix, gdIndex+1, t.Label), selector.ColorUnSelected)
		},
		FooterFunc: func(sl selector.Model, obj interface{}, gdIndex int) string {
			footer := footerText
			if footer == "" {
				footer = "Space: toggle, Enter: confirm"
			}
			return common.FontColor(footer, selector.ColorFooter)
		},
		FinishedFunc: func(s interface{}) string {
			return ""
		},
	}

	m := &multiselectModel{
		ctrlCPressedOnce:    false,
		showCancelMsg:       false,
		selected:            selected,
		items:               item,
		headerText:          headerText,
		footerText:          footerText,
		autocompleteEnabled: autocomplete,
		autocompleteBuffer:  "",
		sl:                  sl,
	}

	m.sl.FooterFunc = func(sl selector.Model, obj interface{}, gdIndex int) string {
		footer := footerText
		if footer == "" {
			footer = "Space: toggle, Enter: confirm"
		}
		if m.autocompleteEnabled {
			footer = formatAutocompleteFooter(footer, m.autocompleteBuffer)
		}
		return common.FontColor(footer, selector.ColorFooter)
	}

	// Set initial index to first non-disabled item
	// Add +1 to account for the initial position (selector starts at 0, we need to move to startIndex)
	for i := 0; i < startIndex+1; i++ {
		m.sl.Update(tea.KeyMsg{Type: tea.KeyDown})
	}

	p := tea.NewProgram(m)
	err = p.Start()
	if err != nil {
		result, _ := json.Marshal(&MultiselectResult{
			SelectedIndices: []string{},
			Error:           fmt.Sprintf("%s", err),
		})
		return string(result)
	}
	if m.canceled || m.sl.Canceled() {
		result, _ := json.Marshal(&MultiselectResult{
			SelectedIndices: []string{},
			Error:           "Cancelled",
		})
		return string(result)
	}
	indices := []string{}
	for idx := range m.selected {
		// Filter out disabled items from results
		if idx < len(m.items) && !m.items[idx].Disabled {
			indices = append(indices, fmt.Sprintf("%d", idx))
		}
	}
	result, _ := json.Marshal(&MultiselectResult{
		SelectedIndices: indices,
		Error:           "",
	})
	return string(result)
}
