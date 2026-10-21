import { useSetAtom } from "jotai";
import { analysisSaveRequestAtom } from "../sessionAtoms";
import { ToolbarButton } from "@/components/ToolbarButton";

export default function SaveButton() {
  const request = useSetAtom(analysisSaveRequestAtom);
  return (
    <ToolbarButton
      tooltip="Save analysis session now"
      icon="ri:save-3-line"
      onClick={() => request((value) => value + 1)}
    />
  );
}
