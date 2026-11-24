import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import {
  keyParts,
  orderedScopes,
  scopeForPath,
  SHORTCUTS,
} from "@/lib/shortcuts";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useAtom } from "jotai";
import { useRouter } from "next/router";
import { shortcutsOpenAtom } from "./states";

export default function ShortcutsDialog() {
  const [open, setOpen] = useAtom(shortcutsOpenAtom);
  const { pathname } = useRouter();
  useKeyboardShortcut(
    "?",
    (event) => {
      event.preventDefault();
      setOpen(true);
    },
    !open
  );

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      fullWidth
      maxWidth="sm"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <DialogTitle id="keyboard-shortcuts-title">
        Keyboard shortcuts
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {orderedScopes(scopeForPath(pathname)).map((scope) => (
            <Box key={scope} component="section">
              <Typography component="h3" variant="subtitle2" mb={0.75}>
                {scope}
              </Typography>
              <Stack
                component="ul"
                spacing={0.75}
                sx={{ m: 0, p: 0, listStyle: "none" }}
              >
                {SHORTCUTS[scope].map(({ keys, label }) => (
                  <Stack
                    component="li"
                    direction="row"
                    key={label}
                    gap={1}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="body2">{label}</Typography>
                    <Stack
                      direction="row"
                      useFlexGap
                      flexWrap="wrap"
                      justifyContent="flex-end"
                      gap={0.4}
                    >
                      {keys
                        .flatMap((key) => keyParts(key))
                        .map((part, index) => (
                          <Box
                            key={index}
                            component="kbd"
                            sx={{
                              border: 1,
                              borderColor: "divider",
                              bgcolor: "action.hover",
                              borderRadius: 0.7,
                              px: 0.65,
                              fontSize: "0.75rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {part}
                          </Box>
                        ))}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={() => setOpen(false)}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
