import { atomWithStorage, createJSONStorage } from "jotai/utils";

export const storedAtom = <T>(
  key: string,
  initialValue: T,
  isValid?: (value: unknown) => value is T
) => {
  const baseStorage = createJSONStorage<T>();

  const storage: typeof baseStorage = {
    ...baseStorage,
    getItem: (storageKey, initial) => {
      const value = baseStorage.getItem(storageKey, initial);
      return isValid && !isValid(value) ? initial : value;
    },
  };

  return atomWithStorage<T>(key, initialValue, storage, { getOnInit: false });
};
