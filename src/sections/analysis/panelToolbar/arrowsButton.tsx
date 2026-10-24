import { ToolbarButton } from "@/components/ToolbarButton";
import { useAtom } from "jotai";
import { analysisArrowPrefsAtom } from "../states";

/**
 * Shows or hides every arrow on the Analysis board: the engine's moves, the
 * top moves, threats and missed moves. It is the same switch as the overlay's
 * Engine arrows control, so the two always agree.
 */
export default function ArrowsButton() {
  const [prefs, setPrefs] = useAtom(analysisArrowPrefsAtom);
  const { enabled } = prefs;

  return (
    <ToolbarButton
      tooltip={enabled ? "Hide all arrows (A)" : "Show all arrows (A)"}
      onClick={() =>
        setPrefs((current) => ({ ...current, enabled: !current.enabled }))
      }
      icon={enabled ? "mdi:lightbulb-on" : "mdi:lightbulb-on-outline"}
      active={enabled}
    />
  );
}
