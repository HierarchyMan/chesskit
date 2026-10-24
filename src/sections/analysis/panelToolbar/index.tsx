import { Stack } from "@mui/material";
import ArrowsButton from "./arrowsButton";
import ClearMovesButton from "./clearMovesButton";
import SaveButton from "./saveButton";
import MoreMenu from "./moreMenu";
import { CopyPgnButton } from "./copyPgnButton";

/** The game-level tools. Moving through the game is on the board's own row. */
export default function PanelToolBar() {
  return (
    <Stack
      direction="row"
      justifyContent="center"
      alignItems="center"
      gap={{ xs: 0, sm: 1.5 }}
      width="100%"
    >
      <ArrowsButton />
      <ClearMovesButton />
      <CopyPgnButton />
      <SaveButton />
      <MoreMenu />
    </Stack>
  );
}
