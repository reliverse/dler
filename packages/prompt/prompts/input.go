package prompts

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/mritd/bubbles/common"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/mritd/bubbles/prompt"
	"golang.org/x/term"
)

type setDefaultValueMsg struct {
	value string
}

type inputModel struct {
	input        *prompt.Model
	defaultValue string
}

func (m *inputModel) Init() tea.Cmd {
	// Send default value as a message if provided
	if m.defaultValue != "" {
		return func() tea.Msg {
			return setDefaultValueMsg{value: m.defaultValue}
		}
	}
	return nil
}

func (m *inputModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// Handle default value setting
	if setDefaultMsg, ok := msg.(setDefaultValueMsg); ok {
		// Simulate typing the default value by sending key messages
		for _, char := range setDefaultMsg.value {
			keyMsg := tea.KeyMsg{
				Type:  tea.KeyRunes,
				Runes: []rune{char},
			}
			_, _ = m.input.Update(keyMsg)
		}
		return m, nil
	}

	// Handle common.DONE message
	switch msg {
	case common.DONE:
		return m, tea.Quit
	}

	// Handle space key presses - convert KeySpace to KeyRunes
	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		if keyMsg.Type == tea.KeySpace {
			// Convert space key to rune message
			spaceKeyMsg := tea.KeyMsg{
				Type:  tea.KeyRunes,
				Runes: []rune{' '},
			}
			_, cmd := m.input.Update(spaceKeyMsg)
			return m, cmd
		}
	}

	_, cmd := m.input.Update(msg)
	return m, cmd
}

func (m inputModel) View() string {
	return m.input.View()
}

func (m inputModel) Value() string {
	return m.input.Value()
}

type InputResult struct {
	Value string `json:"value"`
	Error string `json:"error"`
}

type inputWaitForResizeModel struct {
	minHeight int
	message   string
}

func (m inputWaitForResizeModel) Init() tea.Cmd {
	return tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
		return inputCheckTerminalSizeMsg{}
	})
}

type inputCheckTerminalSizeMsg struct{}

func (m inputWaitForResizeModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		if msg.Height >= m.minHeight {
			return m, tea.Quit
		}
		return m, tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
			return inputCheckTerminalSizeMsg{}
		})
	case inputCheckTerminalSizeMsg:
		fd := int(os.Stdout.Fd())
		_, height, err := term.GetSize(fd)
		if err == nil && height >= m.minHeight {
			return m, tea.Quit
		}
		return m, tea.Tick(time.Second/2, func(t time.Time) tea.Msg {
			return inputCheckTerminalSizeMsg{}
		})
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m inputWaitForResizeModel) View() string {
	fd := int(os.Stdout.Fd())
	_, height, err := term.GetSize(fd)
	if err != nil {
		return fmt.Sprintf("Error checking terminal size: %s\n", err)
	}
	return fmt.Sprintf("\n%s\n\nCurrent height: %d | Required: %d\n\nPlease resize your terminal window to continue...\n", m.message, height, m.minHeight)
}

func inputWaitForTerminalResize(minHeight int, message string) error {
	m := inputWaitForResizeModel{
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

func Input(promptText, echoMode, validateOkPrefix, validateErrPrefix, defaultValue string, required bool, charLimit int) string {
	const minTerminalHeight = 5

	// Check terminal height before starting
	fd := int(os.Stdout.Fd())
	_, height, err := term.GetSize(fd)
	if err != nil {
		result, _ := json.Marshal(&InputResult{
			Value: "",
			Error: fmt.Sprintf("failed to get terminal size: %s", err),
		})
		return string(result)
	}

	if height < minTerminalHeight {
		// Wait for user to resize terminal instead of returning error
		waitMessage := fmt.Sprintf("⚠️  Terminal height too small!\n   Current: %d lines | Required: %d lines", height, minTerminalHeight)
		err = inputWaitForTerminalResize(minTerminalHeight, waitMessage)
		if err != nil {
			result, _ := json.Marshal(&InputResult{
				Value: "",
				Error: fmt.Sprintf("failed to wait for terminal resize: %s", err),
			})
			return string(result)
		}
	}

	m := inputModel{
		input: &prompt.Model{
			ValidateFunc: prompt.VFNotBlank,
			Prompt:       promptText,
			CharLimit:    charLimit,
			EchoMode:     prompt.EchoNormal,
		},
		defaultValue: defaultValue,
	}

	switch echoMode {
	case "none":
		m.input.EchoMode = prompt.EchoNone
	case "password":
		m.input.EchoMode = prompt.EchoPassword
	default:
		m.input.EchoMode = prompt.EchoNormal
	}

	if required {
		m.input.ValidateFunc = prompt.VFNotBlank
	} else {
		m.input.ValidateFunc = prompt.VFDoNothing
	}

	if validateOkPrefix != "" {
		m.input.ValidateOkPrefix = validateOkPrefix
	}

	if validateErrPrefix != "" {
		m.input.ValidateErrPrefix = validateErrPrefix
	}

	p := tea.NewProgram(&m)
	err = p.Start()
	if err != nil {
		result, _ := json.Marshal(&InputResult{
			Value: "",
			Error: fmt.Sprintf("%s", err),
		})
		return string(result)
	}
	result, _ := json.Marshal(&InputResult{
		Value: m.Value(),
		Error: "",
	})
	return string(result)
}
