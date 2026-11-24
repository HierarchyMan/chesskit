import { atomWithStorage, createJSONStorage } from "jotai/utils";

const hasStoredValue = (storageKey: string): boolean => {
  try {
    return window.localStorage.getItem(storageKey) !== null;
  } catch {
    return true;
  }
};

/**
 * `initialValue` must be the same on the server and in the browser's first
 * render, or hydration fails. A `fallback` is where older storage formats are
 * read: it runs only when the key is absent, and jotai reads storage after
 * mount, so it never changes the server-rendered value.
 */
export const storedAtom = <T>(
  key: string,
  initialValue: T,
  isValid?: (value: unknown) => value is T,
  fallback?: () => T | undefined
) => {
  const baseStorage = createJSONStorage<T>();

  const storage: typeof baseStorage = {
    ...baseStorage,
    getItem: (storageKey, initial) => {
      if (fallback && !hasStoredValue(storageKey)) {
        const legacy = fallback();
        if (legacy !== undefined) return legacy;
      }
      const value = baseStorage.getItem(storageKey, initial);
      return isValid && !isValid(value) ? initial : value;
    },
  };

  return atomWithStorage<T>(key, initialValue, storage, { getOnInit: false });
};
