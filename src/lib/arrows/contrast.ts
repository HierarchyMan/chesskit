const channels = (hex: string) =>
  [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
const luminance = (hex: string) => {
  const [r, g, b] = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const arrowContrast = (first: string, second: string) => {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
/** Keep hue while moving only as far toward black or white as this square needs. */
export const readableArrowColor = (
  color: string,
  square: string,
  minimum = 2.3
) => {
  if (arrowContrast(color, square) >= minimum) return color;
  const source = channels(color);
  const mix = (target: number, amount: number) =>
    `#${source
      .map((value) =>
        Math.round(value + (target - value) * amount)
          .toString(16)
          .padStart(2, "0")
      )
      .join("")}`;
  const options = [0, 255].map((target) => {
    let low = 0,
      high = 1;
    for (let i = 0; i < 16; i++) {
      const middle = (low + high) / 2;
      if (arrowContrast(mix(target, middle), square) >= minimum) high = middle;
      else low = middle;
    }
    return {
      color: mix(target, high),
      distance: source.reduce(
        (sum, value) => sum + ((target - value) * high) ** 2,
        0
      ),
    };
  });
  return options.sort((a, b) => a.distance - b.distance)[0].color;
};
