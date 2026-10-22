import { Icon } from "@iconify/react";
import {
  AppBar,
  Box,
  Button,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useSetAtom } from "jotai";
import Image from "next/image";
import { useRouter } from "next/router";
import EngineChip from "./engineChip";
import { findNavItem } from "./navItems";
import {
  commandPaletteOpenAtom,
  importDialogAtom,
  settingsOpenAtom,
} from "./states";

interface Props {
  darkMode: boolean;
  switchDarkMode: () => void;
  onMenuClick: () => void;
}

export default function NavBar({
  darkMode,
  switchDarkMode,
  onMenuClick,
}: Props) {
  const router = useRouter();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const isSmOrGreater = useMediaQuery(theme.breakpoints.up("sm"));
  const setImportDialog = useSetAtom(importDialogAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setPaletteOpen = useSetAtom(commandPaletteOpenAtom);

  const current = findNavItem(router.pathname);

  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={0}
      enableColorOnDark
      sx={{
        backgroundColor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        backgroundImage: "none",
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 56, gap: 0.5 }}>
        {!isDesktop && (
          <>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Open menu"
              onClick={onMenuClick}
            >
              <Icon icon="mdi:menu" />
            </IconButton>
            <Image
              src="/favicon-32x32.png"
              alt="Chesskit logo"
              width={28}
              height={28}
            />
          </>
        )}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            ml: 1,
            minWidth: 0,
          }}
        >
          {current && (
            <Icon
              icon={current.icon}
              height={22}
              color={current.accent}
              style={{ flexShrink: 0 }}
            />
          )}
          <Typography
            variant="h6"
            fontSize="1.05rem"
            fontWeight={600}
            noWrap
            sx={{ minWidth: 0 }}
            title={current?.label ?? "Chesskit"}
          >
            {current?.label ?? "Chesskit"}
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title="Paste a PGN, FEN, link or image (or just press Ctrl+V)">
          <Button
            color="inherit"
            onClick={() => setImportDialog({ open: true })}
            startIcon={<Icon icon="mdi:clipboard-plus-outline" height={20} />}
            sx={{
              borderRadius: 5,
              minWidth: 0,
              px: isSmOrGreater ? 1.5 : 1,
              "& .MuiButton-startIcon": { mr: isSmOrGreater ? 0.75 : 0 },
            }}
          >
            {isSmOrGreater ? "Import" : ""}
          </Button>
        </Tooltip>

        <EngineChip />

        <Tooltip title="Quick actions (Ctrl+K)">
          <IconButton
            color="inherit"
            aria-label="Quick actions"
            onClick={() => setPaletteOpen(true)}
          >
            <Icon icon="mdi:magnify" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Settings">
          <IconButton
            color="inherit"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Icon icon="mdi:cog-outline" />
          </IconButton>
        </Tooltip>

        <Tooltip
          title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
        >
          <IconButton
            color="inherit"
            aria-label="Switch theme"
            onClick={switchDarkMode}
          >
            <Icon icon={darkMode ? "mdi:brightness-7" : "mdi:brightness-4"} />
          </IconButton>
        </Tooltip>

        {isSmOrGreater && (
          <Tooltip title="Source on GitHub">
            <IconButton
              color="inherit"
              aria-label="GitHub"
              component="a"
              href="https://github.com/GuillaumeSD/Chesskit"
              target="_blank"
              rel="noopener noreferrer"
              edge="end"
            >
              <Icon icon="mdi:github" />
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  );
}
