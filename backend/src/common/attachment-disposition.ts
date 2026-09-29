export function attachmentDisposition(fileName: string): string {
  const name = fileName.replace(/[\p{Cc}"\\]/gu, '_');
  // HTTP headers must be Latin-1; RFC 5987 preserves Cyrillic without sending raw Unicode.
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (character) => '%' + character.charCodeAt(0).toString(16).toUpperCase(),
  );
  return "attachment; filename*=UTF-8''" + encoded;
}
