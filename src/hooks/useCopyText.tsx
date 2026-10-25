import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  TextField,
} from "@mui/material";
import { useState } from "react";

/** Clipboard writes can be unavailable or denied. Keep the requested text copyable. */
export function useCopyText() {
  const [notice, setNotice] = useState("");
  const [fallback, setFallback] = useState<{
    label: string;
    text: string;
  } | null>(null);
  const copy = async (text: string, label: string) => {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copied`);
    } catch {
      setFallback({ label, text });
    }
  };
  const feedback = (
    <>
      <Snackbar
        open={!!notice}
        autoHideDuration={2500}
        onClose={() => setNotice("")}
        message={notice}
      />
      <Dialog
        open={!!fallback}
        onClose={() => setFallback(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Copy {fallback?.label}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Clipboard access was unavailable. Select and copy the text below.
          </Alert>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={4}
            maxRows={14}
            label={fallback?.label ?? "Text"}
            value={fallback?.text ?? ""}
            slotProps={{
              input: { readOnly: true },
              htmlInput: {
                onFocus: (event: React.FocusEvent<HTMLTextAreaElement>) =>
                  event.target.select(),
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFallback(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
  return { copy, feedback };
}
