/** The async Clipboard API is denied in unfocused documents, insecure contexts and some embedded browsers. */
const copyWithSelection = (text: string): boolean => {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  Object.assign(field.style, {
    position: "fixed",
    top: "0",
    left: "0",
    opacity: "0",
  });
  const active = document.activeElement;
  document.body.appendChild(field);
  field.select();
  try {
    // Deprecated but the only copy route left when the async API is denied.
    // eslint-disable-next-line @typescript-eslint/no-deprecated, deprecation/deprecation
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    if (active instanceof HTMLElement) active.focus();
  }
};

/** Resolves true only when the text reached the clipboard. */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based copy.
  }
  return copyWithSelection(text);
};
