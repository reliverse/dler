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
func CreateSelection(jsonData, headerText, footerText *C.char, perPage int) *C.char {
	result := prompts.Selection(str(jsonData), str(headerText), str(footerText), perPage)
	return ch(result)
}

//export CreatePrompt
func CreatePrompt(prompText, echoMode, validateOkPrefix, validateErrPrefix, defaultValue *C.char, required bool, charLimit int) *C.char {
	result := prompts.Input(str(prompText), str(echoMode), str(validateOkPrefix), str(validateErrPrefix), str(defaultValue), required, charLimit)
	return ch(result)
}

//export CreateMultiselect
func CreateMultiselect(jsonData, headerText, footerText *C.char, perPage int) *C.char {
	result := prompts.Multiselect(str(jsonData), str(headerText), str(footerText), perPage)
	return ch(result)
}

//export CreateConfirm
func CreateConfirm(promptText, headerText, footerText *C.char) *C.char {
	result := prompts.Confirm(str(promptText), str(headerText), str(footerText))
	return ch(result)
}
