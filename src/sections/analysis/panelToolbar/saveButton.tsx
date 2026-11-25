import { useSetAtom } from "jotai";
import { analysisSaveRequestAtom } from "../sessionAtoms";
import { ToolbarButton } from "@/components/ToolbarButton";

export default function SaveButton() {
  const request = useSetAtom(analysisSaveRequestAtom);
  return (
    <ToolbarButton
      tooltip="Save analysis session now"
      icon="mdi:content-save-outline"
      onClick={() => request((value) => value + 1)}
    />
  );
}
