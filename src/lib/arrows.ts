import { Arrow } from "react-chessboard/dist/chessboard/types";

// react-chessboard keys each arrow by its squares, so two arrows between the
// same squares are an error. The first one wins.
export const uniqueArrows = (arrows: Arrow[]): Arrow[] => {
  const seen = new Set<string>();

  return arrows.filter(([from, to]) => {
    const key = `${from}-${to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
