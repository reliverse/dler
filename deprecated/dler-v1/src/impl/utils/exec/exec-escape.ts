const metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;

export function escapeCommand(arg: string): string {
  return arg.replace(metaCharsRegExp, "^$1");
}

export function escapeArgument(arg: string, doubleEscapeMetaChars?: boolean): string {
  let result = `${arg}`;
  result = result.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
  result = result.replace(/(?=(\\+?)?)\1$/, "$1$1");
  result = `"${result}"`;
  result = result.replace(metaCharsRegExp, "^$1");
  if (doubleEscapeMetaChars) {
    result = result.replace(metaCharsRegExp, "^$1");
  }
  return result;
}
