import { useSetAtom } from "jotai";
import { boardOrientationAtom } from "../states";
import { ToolbarButton } from "@/components/ToolbarButton";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

export default function FlipBoardButton() {
  const setBoardOrientation = useSetAtom(boardOrientationAtom);

  useKeyboardShortcut("f", () => setBoardOrientation((prev) => !prev));

  return (
    <ToolbarButton
      tooltip="Flip board (F)"
      onClick={() => setBoardOrientation((prev) => !prev)}
      icon="eva:flip-fill"
    />
  );
}
