import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import {
  keyParts,
  orderedScopes,
  scopeForPath,
  SHORTCUTS,
} from "@/lib/shortcuts";
import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useAtom } from "jotai";
import { useRouter } from "next/router";
import { Fragment } from "react";
import { shortcutsOpenAtom } from "./states";

export default function ShortcutsDialog() {
  const [open, setOpen] = useAtom(shortcutsOpenAtom);
  const { pathname } = useRouter();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));

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
      fullScreen={isSmall}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <DialogTitle
        id="keyboard-shortcuts-title"
        sx={{ display: "flex", alignItems: "center", gap: 1, pr: 2 }}
      >
        <Icon icon="mdi:keyboard-outline" height={22} />
        <Box sx={{ flexGrow: 1 }}>Keyboard shortcuts</Box>
        <IconButton
          onClick={() => setOpen(false)}
          aria-label="Close"
          edge="end"
          size="small"
        >
          <Icon icon="mdi:close" height={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {orderedScopes(scopeForPath(pathname)).map((scope) => (
            <Box key={scope} component="section">
              <Typography
                component="h3"
                variant="overline"
                color="text.secondary"
                sx={{
                  display: "block",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  mb: 0.75,
                }}
              >
                {scope}
              </Typography>
              <Stack
                component="ul"
                spacing={0.85}
                sx={{ m: 0, p: 0, listStyle: "none" }}
              >
                {SHORTCUTS[scope].map(({ keys, label }) => (
                  <Stack
                    component="li"
                    direction="row"
                    key={label}
                    gap={1.5}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="body2">{label}</Typography>
                    <Stack
                      direction="row"
                      useFlexGap
                      flexWrap="wrap"
                      alignItems="center"
                      justifyContent="flex-end"
                      gap={0.5}
                      sx={{ flexShrink: 0 }}
                    >
                      {keys.map((keyCombo, altIndex) => {
                        const parts = keyParts(keyCombo);
                        return (
                          <Fragment key={`${keyCombo}-${altIndex}`}>
                            {altIndex > 0 && (
                              <Typography
                                component="span"
                                variant="caption"
                                color="text.secondary"
                                sx={{ px: 0.25, userSelect: "none" }}
                              >
                                /
                              </Typography>
                            )}
                            <Stack
                              direction="row"
                              alignItems="center"
                              gap={0.35}
                            >
                              {parts.map((part, partIndex) => (
                                <Fragment key={`${part}-${partIndex}`}>
                                  {partIndex > 0 && (
                                    <Typography
                                      component="span"
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ userSelect: "none" }}
                                    >
                                      +
                                    </Typography>
                                  )}
                                  <Box
                                    component="kbd"
                                    sx={{
                                      border: 1,
                                      borderColor: "divider",
                                      bgcolor: "action.hover",
                                      borderRadius: 0.75,
                                      px: 0.75,
                                      py: 0.2,
                                      fontFamily: "inherit",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      lineHeight: 1.35,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {part}
                                  </Box>
                                </Fragment>
                              ))}
                            </Stack>
                          </Fragment>
                        );
                      })}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button autoFocus onClick={() => setOpen(false)}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
