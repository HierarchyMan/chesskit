import { ToolbarButton } from "@/components/ToolbarButton";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useAtom } from "jotai";
import { topMovesOpenAtom } from "../states";

export default function TopMovesButton() {
  const [open, setOpen] = useAtom(topMovesOpenAtom);
  useKeyboardShortcut("t", () => setOpen((value) => !value));
  return (
    <ToolbarButton
      tooltip="Compare top moves (T)"
      icon="mdi:format-list-numbered"
      active={open}
      onClick={() => setOpen((value) => !value)}
    />
  );
}
