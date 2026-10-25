export interface UciOption {
  name: string;
  type: string;
  default?: string;
  min?: number;
  max?: number;
}

const KEYWORDS = new Set(["type", "default", "min", "max", "var"]);

/** One "option name … type …" line of a "uci" reply, or undefined for other lines. */
export const parseUciOption = (line: string): UciOption | undefined => {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== "option" || tokens[1] !== "name") return undefined;

  const typeIndex = tokens.indexOf("type", 2);
  if (typeIndex < 3) return undefined;

  const option: UciOption = {
    name: tokens.slice(2, typeIndex).join(" "),
    type: tokens[typeIndex + 1] ?? "",
  };

  // Values run until the next keyword; a default may be empty or hold spaces.
  for (let i = typeIndex + 2; i < tokens.length; i++) {
    const key = tokens[i];
    if (!KEYWORDS.has(key) || key === "var") continue;
    let end = i + 1;
    while (end < tokens.length && !KEYWORDS.has(tokens[end])) end++;
    const value = tokens.slice(i + 1, end).join(" ");
    if (key === "default") option.default = value;
    if (key === "min" || key === "max") {
      const number = Number(value);
      if (Number.isFinite(number)) option[key] = number;
    }
    i = end - 1;
  }

  return option;
};

export const parseUciOptions = (lines: string[]): Map<string, UciOption> => {
  const options = new Map<string, UciOption>();
  for (const line of lines) {
    const option = parseUciOption(line);
    if (option) options.set(option.name.toLowerCase(), option);
  }
  return options;
};

/** "setoption" for a spin option, clamped to the engine's range; nothing if it lacks the option. */
export const setSpinOption = (
  options: Map<string, UciOption>,
  name: string,
  value: number
): string | undefined => {
  const option = options.get(name.toLowerCase());
  if (!option || option.type !== "spin") return undefined;
  const clamped = Math.max(
    option.min ?? value,
    Math.min(option.max ?? value, Math.round(value))
  );
  return `setoption name ${option.name} value ${clamped}`;
};
