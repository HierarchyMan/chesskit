import dynamic from "next/dynamic";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { importDialogAtom, settingsOpenAtom } from "./states";
import { moveStoryAtom } from "@/lib/moveStoryState";

const Settings = dynamic(() => import("../settings/settingsDialog"), {
  ssr: false,
});
const Import = dynamic(() => import("../importDialog/smartImportDialog"), {
  ssr: false,
});
const Story = dynamic(() => import("@/components/moveStoryDialog"), {
  ssr: false,
});

let warmed = false;
export const warmDialogs = () => {
  if (warmed) return;
  warmed = true;
  void import("../settings/settingsDialog");
  void import("../importDialog/smartImportDialog");
  void import("@/components/moveStoryDialog");
};

// Keep mounted after first use: removing a closing dialog would cut off its exit animation.
export default function GlobalDialogs() {
  useEffect(() => {
    const timer = setTimeout(warmDialogs, 8000);
    return () => clearTimeout(timer);
  }, []);
  const settings = useAtomValue(settingsOpenAtom);
  const importing = useAtomValue(importDialogAtom).open;
  const story = useAtomValue(moveStoryAtom).open;
  const [used, setUsed] = useState({
    settings: false,
    importing: false,
    story: false,
  });
  useEffect(() => {
    if (settings || importing || story)
      setUsed((previous) => ({
        settings: previous.settings || settings,
        importing: previous.importing || importing,
        story: previous.story || story,
      }));
  }, [settings, importing, story]);
  return (
    <>
      {(settings || used.settings) && <Settings />}
      {(importing || used.importing) && <Import />}
      {(story || used.story) && <Story />}
    </>
  );
}
