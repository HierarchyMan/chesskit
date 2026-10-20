import { ENGINE_LABELS } from "@/constants";
import { engineNameAtom } from "@/sections/analysis/states";
import { isEngineSupported } from "@/lib/engine/shared";
import { EngineName } from "@/types/enums";
import { Icon } from "@iconify/react";
import {
  Dialog,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { useAtom, useSetAtom } from "jotai";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { HOME_ITEM, NAV_ITEMS } from "./navItems";
import { commandPaletteOpenAtom, importDialogAtom, settingsOpenAtom } from "./states";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  run: () => void;
}

interface Props {
  switchDarkMode: () => void;
}

export default function CommandPalette({ switchDarkMode }: Props) {
  const [open, setOpen] = useAtom(commandPaletteOpenAtom);
  const setEngineName = useSetAtom(engineNameAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setImportDialog = useSetAtom(importDialogAtom);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = [HOME_ITEM, ...NAV_ITEMS].map((item) => ({
      id: `go-${item.id}`,
      label: `Go to ${item.label}`,
      hint: item.description,
      icon: item.icon,
      run: () => router.push(item.href),
    }));

    const engines: Command[] = Object.values(EngineName)
      .filter(isEngineSupported)
      .map((name) => ({
        id: `engine-${name}`,
        label: `Use ${ENGINE_LABELS[name].small} for analysis`,
        icon: "mdi:chip",
        run: () => setEngineName(name),
      }));

    return [
      ...pages,
      {
        id: "import",
        label: "Import a PGN, FEN or image",
        hint: "Or just press Ctrl+V on any page",
        icon: "mdi:clipboard-plus-outline",
        run: () => setImportDialog({ open: true }),
      },
      {
        id: "settings",
        label: "Open settings",
        icon: "mdi:cog-outline",
        run: () => setSettingsOpen(true),
      },
      {
        id: "theme",
        label: "Switch light or dark theme",
        icon: "mdi:brightness-6",
        run: switchDarkMode,
      },
      ...engines,
    ];
  }, [router, setEngineName, setImportDialog, setSettingsOpen, switchDarkMode]);

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return commands.filter((command) =>
      words.every((word) => command.label.toLowerCase().includes(word))
    );
  }, [commands, query]);

  const execute = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    command.run();
  };

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { position: "absolute", top: "12vh", m: 0, width: "calc(100% - 32px)", maxWidth: 560 } } }}
    >
      <TextField
        autoFocus
        fullWidth
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIndex((value) => Math.min(filtered.length - 1, value + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setIndex((value) => Math.max(0, value - 1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            execute(filtered[index]);
          }
        }}
        placeholder="Where to? Try “puzzles”, “reckless” or “theme”"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Icon icon="mdi:magnify" height={22} />
              </InputAdornment>
            ),
          },
          htmlInput: { "aria-label": "Quick actions" },
        }}
      />
      <List sx={{ maxHeight: 360, overflowY: "auto" }}>
        {filtered.map((command, i) => (
          <ListItemButton
            key={command.id}
            selected={i === index}
            onMouseMove={() => setIndex(i)}
            onClick={() => execute(command)}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Icon icon={command.icon} height={22} />
            </ListItemIcon>
            <ListItemText primary={command.label} secondary={command.hint} />
          </ListItemButton>
        ))}
        {!filtered.length && (
          <Typography sx={{ p: 2, opacity: 0.7 }}>Nothing matches “{query}”.</Typography>
        )}
      </List>
    </Dialog>
  );
}
