import { Button, Stack } from "@mui/material";
import { Icon } from "@iconify/react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  analysisSaveRequestAtom,
  analysisSaveStateAtom,
} from "../sessionAtoms";
import MoreMenu from "./moreMenu";
import { CopyPgnButton } from "./copyPgnButton";

/** Compact bottom game-level tools. Navigation stays attached to the board. */
export default function PanelToolBar() {
  const saveState = useAtomValue(analysisSaveStateAtom);
  const retrySave = useSetAtom(analysisSaveRequestAtom);

  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={1}
      width="100%"
    >
      <Stack direction="row" alignItems="center" gap={0.5}>
        {saveState.status === "error" && (
          <Button
            size="small"
            color="error"
            variant="text"
            startIcon={<Icon icon="mdi:cloud-alert" height={16} />}
            onClick={() => retrySave((value) => value + 1)}
          >
            Retry save
          </Button>
        )}
      </Stack>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <CopyPgnButton />
        <MoreMenu />
      </Stack>
    </Stack>
  );
}
