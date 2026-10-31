export function localMapId() {
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  return `local-${Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('')}`;
}
