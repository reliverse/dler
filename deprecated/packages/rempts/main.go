package main

/*
#include <stdlib.h>
#include <string.h>
*/
import "C"

import (
	"unsafe"

	"github.com/reliverse/dler/packages/prompt/prompts"
)

func ch(str string) *C.char {
	return C.CString(str)
}

func str(ch *C.char) string {
	return C.GoString(ch)
}

func main() {}

//export FreeString
func FreeString(str *C.char) {
	C.free(unsafe.Pointer(str))
}

//export CreateSelection
func CreateSelection(jsonData, headerText, footerText *C.char, perPage int, autocomplete bool, defaultValue, initialValue *C.char) *C.char {
	result := prompts.Selection(str(jsonData), str(headerText), str(footerText), perPage, autocomplete, str(defaultValue), str(initialValue))
	return ch(result)
}

//export CreatePrompt
func CreatePrompt(prompText, echoMode, validateOkPrefix, validateErrPrefix, defaultValue, initialValue *C.char, required bool, charLimit int) *C.char {
	result := prompts.Input(str(prompText), str(echoMode), str(validateOkPrefix), str(validateErrPrefix), str(defaultValue), str(initialValue), required, charLimit)
	return ch(result)
}

//export CreateMultiselect
func CreateMultiselect(jsonData, headerText, footerText *C.char, perPage int, autocomplete bool, preselectedValues, initialCursorValue *C.char) *C.char {
	result := prompts.Multiselect(str(jsonData), str(headerText), str(footerText), perPage, autocomplete, str(preselectedValues), str(initialCursorValue))
	return ch(result)
}

//export CreateConfirm
func CreateConfirm(promptText, headerText, footerText *C.char, defaultValue, initialValue *C.char) *C.char {
	result := prompts.Confirm(str(promptText), str(headerText), str(footerText), str(defaultValue), str(initialValue))
	return ch(result)
}

//export CreateGroupMultiselect
func CreateGroupMultiselect(jsonData, headerText, footerText *C.char, perPage int, autocomplete, selectableGroups bool, preselectedValues, initialCursorValue *C.char, groupSpacing int) *C.char {
	result := prompts.GroupMultiselect(str(jsonData), str(headerText), str(footerText), perPage, autocomplete, selectableGroups, str(preselectedValues), str(initialCursorValue), groupSpacing)
	return ch(result)
}
