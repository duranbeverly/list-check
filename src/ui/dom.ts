// Find required controls once and fail clearly if the page markup drifts.
export function getRequiredElement<T extends Element>(
  id: string,
  elementType: { new (): T },
): T {
  const element = document.getElementById(id);
  if (!(element instanceof elementType)) {
    throw new Error(`The page is missing the required #${id} control.`);
  }
  return element;
}
