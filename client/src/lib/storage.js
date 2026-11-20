export function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

/**
 * Removes every key this app owns, including the theme keys that predate
 * STORAGE_KEYS. Returns the number of keys removed.
 */
export function clearWellbyStorage(storage = globalThis.window?.localStorage) {
  if (!storage) {
    return 0;
  }

  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key.startsWith("wellby")) {
      keys.push(key);
    }
  }

  keys.forEach((key) => storage.removeItem(key));
  return keys.length;
}
