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

type groupMultiselectModel struct {
	sl                    selector.Model
	selected              map[int]bool
	items                 []GroupListItem
	headerText            string
	footerText            string
	canceled              bool
	ctrlCPressedOnce      bool
	ctrlCPressTime        time.Time
	showCancelMsg         bool
	autocompleteEnabled   bool
	autocompleteBuffer    string
	autocompleteLastInput time.Time
	selectableGroups      bool
	groupIndices          map[int]string   // Maps item index to group name
	groupItemIndices      map[string][]int // Maps group name to item indices
}

func (m groupMultiselectModel) Init() tea.Cmd {
	return nil
}

type groupMultiselectResetCancelMsg struct{}

func (m *groupMultiselectModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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
			return groupMultiselectResetCancelMsg{}
		})
	}

	// Handle reset message
	if _, ok := msg.(groupMultiselectResetCancelMsg); ok {
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
			// Prevent toggling disabled items and non-selectable group headers
			if currentIndex < len(m.items) {
				item := m.items[currentIndex]
				if item.Disabled {
					return m, nil
				}
				// If it's a group header and groups aren't selectable, skip
				if item.IsGroupHeader && !m.selectableGroups {
					return m, nil
				}
				// If it's a group header and groups are selectable, toggle all items in group
				if item.IsGroupHeader && m.selectableGroups {
					groupName := item.GroupName
					if itemIndices, ok := m.groupItemIndices[groupName]; ok {
						allSelected := true
						for _, idx := range itemIndices {
							if !m.selected[idx] {
								allSelected = false
								break
							}
						}
						// Toggle all items in group
						for _, idx := range itemIndices {
							if allSelected {
								delete(m.selected, idx)
							} else {
								m.selected[idx] = true
							}
						}
					}
					return m, nil
				}
			}
			// Toggle regular item
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
			// Move up, skipping disabled items and non-selectable group headers
			_, cmd := m.sl.Update(msg)
			// After update, check if we're on a disabled item or non-selectable group header and skip if needed
			guard := 0
			maxGuards := len(m.items) * 2
			for guard < maxGuards && m.sl.Index() < len(m.items) {
				item := m.items[m.sl.Index()]
				if item.Disabled {
					prevIndex := m.sl.Index()
					_, cmd = m.sl.Update(tea.KeyMsg{Type: tea.KeyUp})
					if m.sl.Index() == prevIndex {
						// Can't move further, break to avoid infinite loop
						break
					}
					guard++
					continue
				}
				if item.IsGroupHeader && !m.selectableGroups {
					prevIndex := m.sl.Index()
					_, cmd = m.sl.Update(tea.KeyMsg{Type: tea.KeyUp})
					if m.sl.Index() == prevIndex {
						// Can't move further, break to avoid infinite loop
						break
					}
					guard++
					continue
				}
				break
			}
			return m, cmd
		case "down", "j":
			// Move down, skipping disabled items and non-selectable group headers
			_, cmd := m.sl.Update(msg)
			// After update, check if we're on a disabled item or non-selectable group header and skip if needed
			guard := 0
			maxGuards := len(m.items) * 2
			for guard < maxGuards && m.sl.Index() < len(m.items) {
				item := m.items[m.sl.Index()]
				if item.Disabled {
					prevIndex := m.sl.Index()
					_, cmd = m.sl.Update(tea.KeyMsg{Type: tea.KeyDown})
					if m.sl.Index() == prevIndex {
						// Can't move further, break to avoid infinite loop
						break
					}
					guard++
					continue
				}
				if item.IsGroupHeader && !m.selectableGroups {
					prevIndex := m.sl.Index()
					_, cmd = m.sl.Update(tea.KeyMsg{Type: tea.KeyDown})
					if m.sl.Index() == prevIndex {
						// Can't move further, break to avoid infinite loop
						break
					}
					guard++
					continue
				}
				break
			}
			return m, cmd
		}
	}

	_, cmd := m.sl.Update(msg)
	return m, cmd
}

func (m groupMultiselectModel) View() string {
	view := m.sl.View()
	if m.showCancelMsg {
		view += "\n" + common.FontColor("Press Ctrl+C again to exit", "yellow")
	}
	return view
}

type GroupListItem struct {
	Value         string `json:"value"`
	Label         string `json:"label"`
	Hint          string `json:"hint"`
	Disabled      bool   `json:"disabled"`
	IsGroupHeader bool   `json:"isGroupHeader"`
	GroupName     string `json:"groupName"`
}

type GroupMultiselectResult struct {
	SelectedIndices []string `json:"selectedIndices"`
	Error           string   `json:"error"`
}

type groupMultiselectWaitForResizeModel struct {
	minHeight int
	message   string
}

func (m groupMultiselectWaitForResizeModel) Init() tea.Cmd {
	return tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
		return groupMultiselectCheckTerminalSizeMsg{}
	})
}

type groupMultiselectCheckTerminalSizeMsg struct{}

func (m groupMultiselectWaitForResizeModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		if msg.Height >= m.minHeight {
			return m, tea.Quit
		}
		return m, tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
			return groupMultiselectCheckTerminalSizeMsg{}
		})
	case groupMultiselectCheckTerminalSizeMsg:
		fd := int(os.Stdout.Fd())
		_, height, err := term.GetSize(fd)
		if err == nil && height >= m.minHeight {
			return m, tea.Quit
		}
		return m, tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
			return groupMultiselectCheckTerminalSizeMsg{}
		})
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m groupMultiselectWaitForResizeModel) View() string {
	fd := int(os.Stdout.Fd())
	_, height, err := term.GetSize(fd)
	if err != nil {
		return fmt.Sprintf("Error checking terminal size: %s\n", err)
	}
	return fmt.Sprintf("\n%s\n\nCurrent height: %d | Required: %d\n\nPlease resize your terminal window to continue...\n", m.message, height, m.minHeight)
}

func groupMultiselectWaitForTerminalResize(minHeight int, message string) error {
	m := groupMultiselectWaitForResizeModel{
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

func (m *groupMultiselectModel) handleAutocompleteKey(msg tea.KeyMsg) bool {
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

func (m *groupMultiselectModel) focusAutocompleteMatch() {
	if m.autocompleteBuffer == "" {
		return
	}
	idx := m.findAutocompleteMatch()
	if idx >= 0 {
		m.moveSelectorTo(idx)
	}
}

func (m *groupMultiselectModel) findAutocompleteMatch() int {
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
		// Skip group headers if they're not selectable
		if item.IsGroupHeader && !m.selectableGroups {
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

func (m *groupMultiselectModel) moveSelectorTo(target int) {
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

func (m *groupMultiselectModel) stepSelector(direction int) bool {
	key := tea.KeyMsg{Type: tea.KeyDown}
	if direction < 0 {
		key = tea.KeyMsg{Type: tea.KeyUp}
	}
	prev := m.sl.Index()
	m.sl.Update(key)
	if m.sl.Index() == prev {
		return false
	}
	for m.sl.Index() < len(m.items) {
		item := m.items[m.sl.Index()]
		if item.Disabled {
			prev = m.sl.Index()
			m.sl.Update(key)
			if m.sl.Index() == prev {
				return false
			}
			continue
		}
		if item.IsGroupHeader && !m.selectableGroups {
			prev = m.sl.Index()
			m.sl.Update(key)
			if m.sl.Index() == prev {
				return false
			}
			continue
		}
		break
	}
	return true
}

func GroupMultiselect(jsonData, headerText, footerText string, perPage int, autocomplete, selectableGroups bool, defaultValue, initialValue string, groupSpacing int) string {
	// Minimum height: header (1) + perPage items + footer (1) + buffer (2) = perPage + 4
	minTerminalHeight := perPage + 4
	if minTerminalHeight < 5 {
		minTerminalHeight = 5
	}

	// Check terminal height before starting
	fd := int(os.Stdout.Fd())
	_, height, err := term.GetSize(fd)
	if err != nil {
		result, _ := json.Marshal(&GroupMultiselectResult{
			SelectedIndices: []string{},
			Error:           fmt.Sprintf("failed to get terminal size: %s", err),
		})
		return string(result)
	}

	if height < minTerminalHeight {
		// Wait for user to resize terminal instead of returning error
		waitMessage := fmt.Sprintf("⚠️  Terminal height too small!\n   Current: %d lines | Required: %d lines (for perPage=%d)", height, minTerminalHeight, perPage)
		err = groupMultiselectWaitForTerminalResize(minTerminalHeight, waitMessage)
		if err != nil {
			result, _ := json.Marshal(&GroupMultiselectResult{
				SelectedIndices: []string{},
				Error:           fmt.Sprintf("failed to wait for terminal resize: %s", err),
			})
			return string(result)
		}
	}

	var items []GroupListItem
	json.Unmarshal([]byte(jsonData), &items)
	data := []interface{}{}
	for _, val := range items {
		data = append(data, GroupListItem{Value: val.Value, Label: val.Label, Hint: val.Hint, Disabled: val.Disabled, IsGroupHeader: val.IsGroupHeader, GroupName: val.GroupName})
	}

	// Parse defaultValue (JSON array of strings)
	defaultValueSet := make(map[string]bool)
	if defaultValue != "" {
		var defaultVals []string
		json.Unmarshal([]byte(defaultValue), &defaultVals)
		for _, val := range defaultVals {
			defaultValueSet[val] = true
		}
	}

	// Build group indices maps and identify last items in groups
	groupIndices := make(map[int]string)
	groupItemIndices := make(map[string][]int)
	isLastInGroup := make(map[int]bool)
	for i, item := range items {
		if item.IsGroupHeader {
			groupIndices[i] = item.GroupName
			if _, ok := groupItemIndices[item.GroupName]; !ok {
				groupItemIndices[item.GroupName] = []int{}
			}
		} else if item.GroupName != "" {
			groupIndices[i] = item.GroupName
			if _, ok := groupItemIndices[item.GroupName]; !ok {
				groupItemIndices[item.GroupName] = []int{}
			}
			groupItemIndices[item.GroupName] = append(groupItemIndices[item.GroupName], i)
		}
	}
	// Mark last items in each group
	for _, itemIndices := range groupItemIndices {
		if len(itemIndices) > 0 {
			lastItemIndex := itemIndices[len(itemIndices)-1]
			// Check if next item is a group header or end of list
			if lastItemIndex+1 >= len(items) || items[lastItemIndex+1].IsGroupHeader {
				isLastInGroup[lastItemIndex] = true
			}
		}
	}

	// Determine start index based on initialValue
	startIndex := 0
	if initialValue != "" {
		for i, it := range items {
			if it.Value == initialValue && !it.Disabled && !it.IsGroupHeader {
				startIndex = i
				break
			}
		}
	} else {
		// Find first non-disabled, selectable item to start on
		for startIndex < len(items) {
			item := items[startIndex]
			if item.Disabled {
				startIndex++
				continue
			}
			if item.IsGroupHeader && !selectableGroups {
				startIndex++
				continue
			}
			break
		}
		if startIndex >= len(items) {
			startIndex = 0
		}
	}

	selected := make(map[int]bool)
	// Set initial selections based on defaultValue
	for i, item := range items {
		if !item.IsGroupHeader && !item.Disabled && defaultValueSet[item.Value] {
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
			t := obj.(GroupListItem)
			disabled := t.Disabled
			if gdIndex < len(items) {
				disabled = items[gdIndex].Disabled
			}
			currentCursorIndex := sl.Index()
			prefix := " "
			if selected[gdIndex] {
				prefix = "✓"
			}

			// Determine if this is the last item in its group
			isLast := isLastInGroup[gdIndex]
			barChar := "│"
			if isLast {
				barChar = "└"
			}

			// Add group spacing prefix for group headers (except first)
			spacingPrefix := ""
			if t.IsGroupHeader && groupSpacing > 0 && gdIndex > 0 {
				spacingLines := ""
				for i := 0; i < groupSpacing; i++ {
					spacingLines += fmt.Sprintf("\n%s", common.FontColor("│", selector.ColorSelected))
				}
				spacingPrefix = spacingLines
			}

			// Group header styling
			if t.IsGroupHeader {
				// Check if cursor is on an item in this group (group-active state)
				groupActive := false
				if currentCursorIndex >= 0 && currentCursorIndex < len(items) && !items[currentCursorIndex].IsGroupHeader {
					cursorItem := items[currentCursorIndex]
					if cursorItem.GroupName == t.GroupName {
						groupActive = true
					}
				}
				if selectableGroups {
					// Check if all items in group are selected
					allSelected := true
					if itemIndices, ok := groupItemIndices[t.GroupName]; ok {
						for _, idx := range itemIndices {
							if !selected[idx] {
								allSelected = false
								break
							}
						}
					} else {
						allSelected = false
					}
					if allSelected && len(groupItemIndices[t.GroupName]) > 0 {
						prefix = "✓"
					}
					if groupActive {
						if allSelected && len(groupItemIndices[t.GroupName]) > 0 {
							// group-active-selected
							return fmt.Sprintf("%s%s", spacingPrefix, common.FontColor(fmt.Sprintf("%s ┌─ %s", prefix, t.Label), selector.ColorSelected))
						}
						// group-active
						return fmt.Sprintf("%s%s", spacingPrefix, common.FontColor(fmt.Sprintf(" ┌─ %s", t.Label), selector.ColorSelected))
					}
					return fmt.Sprintf("%s%s", spacingPrefix, common.FontColor(fmt.Sprintf("%s ┌─ %s", prefix, t.Label), selector.ColorSelected))
				}
				// When groups are not selectable, still show group-active state
				if groupActive {
					return fmt.Sprintf("%s%s", spacingPrefix, common.FontColor(fmt.Sprintf(" ┌─ %s", t.Label), selector.ColorSelected))
				}
				return fmt.Sprintf("%s%s", spacingPrefix, common.FontColor(fmt.Sprintf(" ┌─ %s", t.Label), selector.ColorSelected))
			}
			// Regular item styling
			if disabled {
				if t.Hint != "" {
					return common.FontColor(fmt.Sprintf("%s %s  [%d] %s (%s) (disabled)", prefix, barChar, gdIndex+1, t.Label, t.Hint), "240")
				}
				return common.FontColor(fmt.Sprintf("%s %s  [%d] %s (disabled)", prefix, barChar, gdIndex+1, t.Label), "240")
			}
			if t.Hint != "" {
				return common.FontColor(fmt.Sprintf("%s %s  [%d] %s (%s)", prefix, barChar, gdIndex+1, t.Label, t.Hint), selector.ColorSelected)
			}
			return common.FontColor(fmt.Sprintf("%s %s  [%d] %s", prefix, barChar, gdIndex+1, t.Label), selector.ColorSelected)
		},
		UnSelectedFunc: func(sl selector.Model, obj interface{}, gdIndex int) string {
			t := obj.(GroupListItem)
			disabled := t.Disabled
			if gdIndex < len(items) {
				disabled = items[gdIndex].Disabled
			}
			currentCursorIndex := sl.Index()
			prefix := " "
			if selected[gdIndex] {
				prefix = "✓"
			}

			// Determine if this is the last item in its group
			isLast := isLastInGroup[gdIndex]
			barChar := "│"
			if isLast {
				barChar = "└"
			}

			// Add group spacing prefix for group headers (except first)
			spacingPrefix := ""
			if t.IsGroupHeader && groupSpacing > 0 && gdIndex > 0 {
				spacingLines := ""
				for i := 0; i < groupSpacing; i++ {
					spacingLines += fmt.Sprintf("\n%s", common.FontColor("│", selector.ColorUnSelected))
				}
				spacingPrefix = spacingLines
			}

			// Group header styling
			if t.IsGroupHeader {
				// Check if cursor is on an item in this group (group-active state)
				groupActive := false
				if currentCursorIndex >= 0 && currentCursorIndex < len(items) && !items[currentCursorIndex].IsGroupHeader {
					cursorItem := items[currentCursorIndex]
					if cursorItem.GroupName == t.GroupName {
						groupActive = true
					}
				}
				if selectableGroups {
					// Check if all items in group are selected
					allSelected := true
					if itemIndices, ok := groupItemIndices[t.GroupName]; ok {
						for _, idx := range itemIndices {
							if !selected[idx] {
								allSelected = false
								break
							}
						}
					} else {
						allSelected = false
					}
					if allSelected && len(groupItemIndices[t.GroupName]) > 0 {
						prefix = "✓"
					}
					if groupActive {
						if allSelected && len(groupItemIndices[t.GroupName]) > 0 {
							// group-active-selected
							return fmt.Sprintf("%s%s", spacingPrefix, common.FontColor(fmt.Sprintf("%s ┌─ %s", prefix, t.Label), selector.ColorUnSelected))
						}
						// group-active
						return fmt.Sprintf("%s%s", spacingPrefix, common.FontColor(fmt.Sprintf(" ┌─ %s", t.Label), selector.ColorUnSelected))
					}
					return fmt.Sprintf("%s%s", spacingPrefix, common.FontColor(fmt.Sprintf("%s ┌─ %s", prefix, t.Label), selector.ColorUnSelected))
				}
				// When groups are not selectable, still show group-active state
				if groupActive {
					return fmt.Sprintf("%s%s", spacingPrefix, common.FontColor(fmt.Sprintf(" ┌─ %s", t.Label), selector.ColorUnSelected))
				}
				return fmt.Sprintf("%s%s", spacingPrefix, common.FontColor(fmt.Sprintf(" ┌─ %s", t.Label), selector.ColorUnSelected))
			}
			// Regular item styling
			if disabled {
				return common.FontColor(fmt.Sprintf("%s %s   %d. %s (disabled)", prefix, barChar, gdIndex+1, t.Label), "240")
			}
			return common.FontColor(fmt.Sprintf("%s %s   %d. %s", prefix, barChar, gdIndex+1, t.Label), selector.ColorUnSelected)
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

	m := &groupMultiselectModel{
		ctrlCPressedOnce:    false,
		showCancelMsg:       false,
		selected:            selected,
		items:               items,
		headerText:          headerText,
		footerText:          footerText,
		autocompleteEnabled: autocomplete,
		autocompleteBuffer:  "",
		sl:                  sl,
		selectableGroups:    selectableGroups,
		groupIndices:        groupIndices,
		groupItemIndices:    groupItemIndices,
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

	// Set initial index to first non-disabled, selectable item
	if startIndex > 0 {
		for i := 0; i < startIndex; i++ {
			m.sl.Update(tea.KeyMsg{Type: tea.KeyDown})
		}
	}

	p := tea.NewProgram(m)
	err = p.Start()
	if err != nil {
		result, _ := json.Marshal(&GroupMultiselectResult{
			SelectedIndices: []string{},
			Error:           fmt.Sprintf("%s", err),
		})
		return string(result)
	}
	if m.canceled || m.sl.Canceled() {
		result, _ := json.Marshal(&GroupMultiselectResult{
			SelectedIndices: []string{},
			Error:           "Cancelled",
		})
		return string(result)
	}
	indices := []string{}
	for idx := range m.selected {
		// Filter out disabled items and group headers from results
		if idx < len(m.items) && !m.items[idx].Disabled && !m.items[idx].IsGroupHeader {
			indices = append(indices, fmt.Sprintf("%d", idx))
		}
	}
	result, _ := json.Marshal(&GroupMultiselectResult{
		SelectedIndices: indices,
		Error:           "",
	})
	return string(result)
}
