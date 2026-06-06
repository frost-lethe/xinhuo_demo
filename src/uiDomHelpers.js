export function setText(element, text) {
  if (element && element.textContent !== text) {
    element.textContent = text;
  }
}
