package prompts

import (
	"os"
	"runtime"
	"strings"

	"golang.org/x/term"
)

var ciEnvKeys = []string{
	"CI",
	"GITHUB_ACTIONS",
	"BUILD_NUMBER",
	"RUN_ID",
}

func envValueIsEnabled(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "0", "false", "no", "off":
		return false
	default:
		return true
	}
}

func isCIEnvironment() bool {
	for _, key := range ciEnvKeys {
		if envValueIsEnabled(os.Getenv(key)) {
			return true
		}
	}
	return false
}

func terminalDescriptorIsTTY(file *os.File) bool {
	if file == nil {
		return false
	}
	return term.IsTerminal(int(file.Fd()))
}

func hasUsableTermInfo() bool {
	if runtime.GOOS == "windows" {
		return true
	}
	termEnv := strings.ToLower(strings.TrimSpace(os.Getenv("TERM")))
	if termEnv == "" || termEnv == "dumb" {
		return false
	}
	return true
}

func isFullyInteractiveTTY() bool {
	return terminalDescriptorIsTTY(os.Stdin) &&
		terminalDescriptorIsTTY(os.Stdout) &&
		hasUsableTermInfo()
}

func shouldValidateTerminalSize() bool {
	if envValueIsEnabled(os.Getenv("DLER_PROMPT_DISABLE_SIZE_CHECK")) {
		return false
	}
	if isCIEnvironment() {
		return false
	}
	return isFullyInteractiveTTY()
}

func getTerminalHeight() (int, error) {
	fd := int(os.Stdout.Fd())
	_, height, err := term.GetSize(fd)
	if err != nil {
		return 0, err
	}
	return height, nil
}
