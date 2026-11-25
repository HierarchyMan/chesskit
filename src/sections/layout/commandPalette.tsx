import { engineLabel } from "@/constants";
import { useModels } from "@/hooks/useModels";
import { engineNameAtom } from "@/sections/analysis/states";
import { describeModel } from "@/lib/engine/modelStatus";
import { Icon } from "@iconify/react";
import {
  Box,
  Dialog,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Typography,
  alpha,
} from "@mui/material";
import { useAtom, useSetAtom } from "jotai";
import { useRouter } from "next/router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { HOME_ITEM, NAV_ITEMS } from "./navItems";
import {
  commandPaletteOpenAtom,
  importDialogAtom,
  settingsOpenAtom,
  settingsTabAtom,
} from "./states";

type CommandGroup = "Pages" | "Actions" | "Analysis Engines";

const GROUP_ORDER: readonly CommandGroup[] = [
  "Pages",
  "Actions",
  "Analysis Engines",
];

interface Command {
  id: string;
  group: CommandGroup;
  label: string;
  hint?: string;
  icon: string;
  active?: boolean;
  run: () => void;
}

interface Props {
  switchDarkMode: () => void;
}

export default function CommandPalette({ switchDarkMode }: Props) {
  const [open, setOpen] = useAtom(commandPaletteOpenAtom);
  const [activeEngine, setEngineName] = useAtom(engineNameAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsTab = useSetAtom(settingsTabAtom);
  const setImportDialog = useSetAtom(importDialogAtom);
  const { models, refresh } = useModels();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const navViaKeyboard = useRef(false);

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
    lastMousePos.current = null;
    navViaKeyboard.current = false;
    void refresh();
  }, [open, refresh]);

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = [HOME_ITEM, ...NAV_ITEMS].map((item) => ({
      id: `go-${item.id}`,
      group: "Pages",
      label: `Go to ${item.label}`,
      hint: item.description,
      icon: item.icon,
      run: () => router.push(item.href),
    }));

    const actions: Command[] = [
      {
        id: "import",
        group: "Actions",
        label: "Import a PGN, FEN, link, or image",
        hint: "Paste from clipboard, upload a file, or load from Chess.com / Lichess",
        icon: "mdi:clipboard-plus-outline",
        run: () => setImportDialog({ open: true }),
      },
      {
        id: "settings",
        group: "Actions",
        label: "Open settings",
        hint: "Board theme, piece set, arrows, engine options",
        icon: "mdi:cog-outline",
        run: () => {
          setSettingsTab("board");
          setSettingsOpen(true);
        },
      },
      {
        id: "models",
        group: "Actions",
        label: "Manage engines and models",
        hint: "Download or remove browser engines, check local bridge",
        icon: "mdi:database-outline",
        run: () => {
          setSettingsTab("models");
          setSettingsOpen(true);
        },
      },
      {
        id: "theme",
        group: "Actions",
        label: "Switch light or dark theme",
        hint: "Toggle between dark mode and light mode",
        icon: "mdi:brightness-6",
        run: switchDarkMode,
      },
    ];

    const engines: Command[] = models
      .filter((view) => view.supported && view.model.roles.analysis)
      .map((view) => {
        const name = view.model.name;
        return {
          id: `engine-${name}`,
          group: "Analysis Engines",
          label: `Use ${engineLabel(name).small} for analysis`,
          hint: describeModel(view).text,
          icon: "mdi:chip",
          active: activeEngine === name,
          run: () => setEngineName(name),
        };
      });

    return [...pages, ...actions, ...engines];
  }, [
    router,
    models,
    activeEngine,
    setEngineName,
    setImportDialog,
    setSettingsOpen,
    setSettingsTab,
    switchDarkMode,
  ]);

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return commands;
    return commands.filter((command) => {
      const haystack =
        `${command.label} ${command.hint ?? ""} ${command.group}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [commands, query]);

  const grouped = useMemo(() => {
    const indexMap = new Map<string, number>();
    filtered.forEach((cmd, i) => indexMap.set(cmd.id, i));
    return GROUP_ORDER.map((group) => ({
      group,
      items: filtered
        .filter((cmd) => cmd.group === group)
        .map((cmd) => ({ command: cmd, flatIndex: indexMap.get(cmd.id) ?? 0 })),
    })).filter((section) => section.items.length > 0);
  }, [filtered]);

  useEffect(() => {
    if (!navViaKeyboard.current) return;
    navViaKeyboard.current = false;
    itemRefs.current[index]?.scrollIntoView({ block: "nearest" });
  }, [index]);

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
      slotProps={{
        paper: {
          sx: {
            position: "absolute",
            top: "12vh",
            m: 0,
            width: "calc(100% - 32px)",
            maxWidth: 560,
            overflow: "hidden",
          },
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 2,
          py: 1.25,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", color: "text.secondary", flexShrink: 0 }}>
          <Icon icon="mdi:magnify" height={22} />
        </Box>
        <InputBase
          autoFocus
          fullWidth
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (!filtered.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              navViaKeyboard.current = true;
              setIndex((value) => (value + 1) % filtered.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              navViaKeyboard.current = true;
              setIndex(
                (value) => (value - 1 + filtered.length) % filtered.length
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              execute(filtered[index]);
            }
          }}
          placeholder="Search pages, actions, or engines…"
          inputProps={{ "aria-label": "Quick actions" }}
          sx={{ fontSize: "0.95rem" }}
        />
        <Box
          component="kbd"
          sx={{
            fontFamily: "inherit",
            fontSize: "0.7rem",
            fontWeight: 600,
            px: 0.75,
            py: 0.25,
            borderRadius: 0.75,
            border: 1,
            borderColor: "divider",
            bgcolor: "action.hover",
            color: "text.secondary",
            flexShrink: 0,
          }}
        >
          Esc
        </Box>
      </Box>

      <List
        dense
        disablePadding
        sx={{ maxHeight: 380, overflowY: "auto", py: 0.75 }}
      >
        {grouped.map(({ group, items }) => (
          <Fragment key={group}>
            <ListSubheader
              disableSticky
              sx={{
                bgcolor: "transparent",
                lineHeight: "28px",
                px: 2,
                pt: 0.5,
                textTransform: "uppercase",
                fontSize: "0.68rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "text.secondary",
              }}
            >
              {group}
            </ListSubheader>
            {items.map(({ command, flatIndex }) => {
              const selected = flatIndex === index;
              return (
                <ListItemButton
                  key={command.id}
                  ref={(el) => {
                    itemRefs.current[flatIndex] = el;
                  }}
                  selected={selected}
                  onMouseMove={(event) => {
                    const prev = lastMousePos.current;
                    if (
                      prev &&
                      prev.x === event.clientX &&
                      prev.y === event.clientY
                    ) {
                      return;
                    }
                    lastMousePos.current = {
                      x: event.clientX,
                      y: event.clientY,
                    };
                    if (index !== flatIndex) setIndex(flatIndex);
                  }}
                  onClick={() => execute(command)}
                  sx={{
                    mx: 1,
                    my: 0.2,
                    borderRadius: 1,
                    px: 1.5,
                    py: 0.75,
                    "&.Mui-selected": {
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.14),
                      "&:hover": {
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 36,
                      color: selected ? "primary.main" : "text.secondary",
                    }}
                  >
                    <Icon icon={command.icon} height={20} />
                  </ListItemIcon>
                  <ListItemText
                    primary={command.label}
                    secondary={command.hint}
                    slotProps={{
                      primary: {
                        variant: "body2",
                        fontWeight: selected ? 600 : 500,
                        noWrap: true,
                      },
                      secondary: {
                        variant: "caption",
                        noWrap: true,
                      },
                    }}
                  />
                  {command.active && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        color: "primary.main",
                        ml: 1,
                        flexShrink: 0,
                      }}
                      title="Active engine"
                    >
                      <Icon icon="mdi:check" height={18} />
                    </Box>
                  )}
                </ListItemButton>
              );
            })}
          </Fragment>
        ))}

        {!filtered.length && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: 2.5, py: 3, textAlign: "center" }}
          >
            Nothing matches &ldquo;{query}&rdquo;.
          </Typography>
        )}
      </List>
    </Dialog>
  );
}
