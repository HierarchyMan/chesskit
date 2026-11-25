import { Icon } from "@iconify/react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { useRouter } from "next/router";
import {
  parseFenLoose,
  positionToFen,
  sanitizePosition,
} from "@/lib/editorPosition";
import { arrangeHistoryAtom } from "../sessionAtoms";
import {
  arrangeFenDraftAtom,
  arrangeStartFenAtom,
  editablePositionAtom,
} from "../states";
import { useArrangeMode } from "./useArrangeMode";

export default function ModeSwitch() {
  const { arrange, enterArrange, finishArrange, leaveArrange, validation } =
    useArrangeMode();
  const position = useAtomValue(editablePositionAtom);
  const draft = useAtomValue(arrangeFenDraftAtom);
  const startFen = useAtomValue(arrangeStartFenAtom);
  const history = useAtomValue(arrangeHistoryAtom);
  const router = useRouter();
  const [confirmExit, setConfirmExit] = useState(false);

  const exitToAnalysis = () => {
    leaveArrange();
    if (router.pathname === "/editor") {
      void router.replace("/analysis", undefined, { scroll: false });
    }
  };

  const hasUnsavedChanges = () => {
    if (history.past.length > 0) return true;
    const effective = draft === null ? position : parseFenLoose(draft);
    if (!effective) return true;
    const currentFen = positionToFen(sanitizePosition(effective));
    return startFen !== null && currentFen !== startFen;
  };

  const handleLeaveClick = () => {
    if (hasUnsavedChanges()) {
      setConfirmExit(true);
    } else {
      exitToAnalysis();
    }
  };

  if (arrange) {
    return (
      <>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Icon icon="mdi:arrow-left" height={16} />}
          onClick={handleLeaveClick}
          sx={{ minHeight: 32, px: 1.25, whiteSpace: "nowrap" }}
        >
          Analyze
        </Button>

        <Dialog
          open={confirmExit}
          onClose={() => setConfirmExit(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Leave board editor?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              You have unsaved changes to this position. Apply the position to
              analyze it, or discard your edits and return to the previous
              study.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmExit(false)}>Stay</Button>
            <Button
              color="error"
              onClick={() => {
                setConfirmExit(false);
                exitToAnalysis();
              }}
            >
              Discard changes
            </Button>
            <Button
              variant="contained"
              disabled={!validation.ok}
              onClick={() => {
                setConfirmExit(false);
                finishArrange();
              }}
            >
              Apply &amp; Analyze
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  return (
    <Tooltip title="Arrange board pieces" disableInteractive>
      <IconButton
        size="small"
        aria-label="Arrange board pieces"
        onClick={() => enterArrange()}
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          border: 1,
          borderColor: "transparent",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Icon icon="mdi:pencil-ruler" height={18} />
      </IconButton>
    </Tooltip>
  );
}
