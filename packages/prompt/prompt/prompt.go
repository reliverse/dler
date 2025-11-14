package prompt

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

type model struct {
	input *prompt.Model
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
		return m, tea.Quit
	}

	_, cmd := m.input.Update(msg)
	return m, cmd
}

func (m model) View() string {
	return m.input.View()
}

func (m model) Value() string {
	return m.input.Value()
}

type Result struct {
	Value string `json:"value"`
	Error string `json:"error"`
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

func Prompt(promptText, echoMode, validateOkPrefix, validateErrPrefix string, required bool, charLimit int) string {
	const minTerminalHeight = 5

	// Check terminal height before starting
	fd := int(os.Stdout.Fd())
	_, height, err := term.GetSize(fd)
	if err != nil {
		result, _ := json.Marshal(&Result{
			Value: "",
			Error: fmt.Sprintf("failed to get terminal size: %s", err),
		})
		return string(result)
	}

	if height < minTerminalHeight {
		// Wait for user to resize terminal instead of returning error
		waitMessage := fmt.Sprintf("⚠️  Terminal height too small!\n   Current: %d lines | Required: %d lines", height, minTerminalHeight)
		err = waitForTerminalResize(minTerminalHeight, waitMessage)
		if err != nil {
			result, _ := json.Marshal(&Result{
				Value: "",
				Error: fmt.Sprintf("failed to wait for terminal resize: %s", err),
			})
			return string(result)
		}
	}

	m := model{input: &prompt.Model{
		ValidateFunc: prompt.VFNotBlank,
		Prompt:       promptText,
		CharLimit:    charLimit,
		EchoMode:     prompt.EchoNormal,
	}}

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
		m.input.ValidateOkPrefix = validateErrPrefix
	}

	if validateErrPrefix != "" {
		m.input.ValidateErrPrefix = validateErrPrefix
	}

	p := tea.NewProgram(&m)
	err = p.Start()
	if err != nil {
		result, _ := json.Marshal(&Result{
			Value: "",
			Error: fmt.Sprintf("%s", err),
		})
		return string(result)
	}
	result, _ := json.Marshal(&Result{
		Value: m.Value(),
		Error: "",
	})
	return string(result)
}
