import { ToolbarButton } from "@/components/ToolbarButton";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useAtom } from "jotai";
import { topMovesOpenAtom } from "../states";

export default function TopMovesButton() {
  const [open, setOpen] = useAtom(topMovesOpenAtom);

  useKeyboardShortcut("t", () => setOpen((value) => !value));

  return (
    <ToolbarButton
      tooltip={open ? "Hide top moves (T)" : "Top moves for either side (T)"}
      onClick={() => setOpen((value) => !value)}
      icon={open ? "mdi:lightbulb-on" : "mdi:lightbulb-on-outline"}
    />
  );
}
