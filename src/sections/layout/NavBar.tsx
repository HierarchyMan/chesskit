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
import Link from "next/link";
import { useRouter } from "next/router";
import EngineChip from "./engineChip";
import { findNavItem } from "./navItems";
import {
  commandPaletteOpenAtom,
  importDialogAtom,
  settingsOpenAtom,
  settingsTabAtom,
} from "./states";

interface Props {
  darkMode: boolean;
  switchDarkMode: () => void;
  onMenuClick: () => void;
}

const iconBtnSx = {
  width: 34,
  height: 34,
  borderRadius: 1,
  color: "text.secondary",
  "&:hover": {
    color: "text.primary",
    bgcolor: "action.hover",
  },
} as const;

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
  const setSettingsTab = useSetAtom(settingsTabAtom);
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
        userSelect: "none",
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 56, height: 56, gap: 0.75 }}>
        {!isDesktop && (
          <>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Open menu"
              onClick={onMenuClick}
              sx={{ width: 34, height: 34, borderRadius: 1 }}
            >
              <Icon icon="mdi:menu" height={22} />
            </IconButton>
            <Link
              href="/"
              prefetch={false}
              aria-label="Chesskit home"
              style={{ display: "flex", flexShrink: 0 }}
            >
              <Image
                src="/favicon-32x32.png"
                alt="Chesskit logo"
                width={26}
                height={26}
              />
            </Link>
          </>
        )}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            ml: isDesktop ? 0.5 : 0.75,
            minWidth: 0,
          }}
        >
          {current && (
            <Box
              sx={{
                display: "flex",
                color: "primary.main",
                flexShrink: 0,
              }}
            >
              <Icon icon={current.icon} height={20} />
            </Box>
          )}
          <Typography
            variant="h6"
            fontSize="1rem"
            fontWeight={600}
            noWrap
            sx={{ minWidth: 0 }}
            title={current?.label ?? "Chesskit"}
          >
            {current?.label ?? "Chesskit"}
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title="Import PGN, FEN, Lichess/Chess.com game, or board image (Ctrl/⌘+V)">
          {isSmOrGreater ? (
            <Button
              size="small"
              color="inherit"
              onClick={() => setImportDialog({ open: true })}
              startIcon={<Icon icon="mdi:clipboard-plus-outline" height={18} />}
              sx={{
                height: 34,
                borderRadius: 1,
                px: 1.5,
                minWidth: 0,
                border: 1,
                borderColor: "divider",
                bgcolor: "action.hover",
                "&:hover": {
                  bgcolor: "action.selected",
                  borderColor: "text.secondary",
                },
              }}
            >
              Import
            </Button>
          ) : (
            <IconButton
              size="small"
              aria-label="Import"
              onClick={() => setImportDialog({ open: true })}
              sx={{
                ...iconBtnSx,
                color: "text.primary",
                border: 1,
                borderColor: "divider",
              }}
            >
              <Icon icon="mdi:clipboard-plus-outline" height={20} />
            </IconButton>
          )}
        </Tooltip>

        <EngineChip />

        <Tooltip title="Quick actions (Ctrl/⌘+K)">
          {isDesktop ? (
            <Button
              size="small"
              color="inherit"
              aria-label="Quick actions"
              onClick={() => setPaletteOpen(true)}
              startIcon={<Icon icon="mdi:magnify" height={18} />}
              sx={{
                height: 34,
                borderRadius: 1,
                px: 1.25,
                minWidth: 0,
                border: 1,
                borderColor: "divider",
                color: "text.secondary",
                fontWeight: 500,
                gap: 1,
                "&:hover": {
                  color: "text.primary",
                  bgcolor: "action.hover",
                  borderColor: "text.secondary",
                },
              }}
            >
              <Typography
                variant="body2"
                color="inherit"
                sx={{ fontSize: "0.82rem" }}
              >
                Search
              </Typography>
              <Box
                component="kbd"
                sx={{
                  fontFamily: "inherit",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  px: 0.6,
                  py: 0.15,
                  borderRadius: 0.75,
                  border: 1,
                  borderColor: "divider",
                  bgcolor: "action.hover",
                  color: "text.secondary",
                  lineHeight: 1.2,
                }}
              >
                Ctrl/⌘K
              </Box>
            </Button>
          ) : (
            <IconButton
              size="small"
              aria-label="Quick actions"
              onClick={() => setPaletteOpen(true)}
              sx={iconBtnSx}
            >
              <Icon icon="mdi:magnify" height={20} />
            </IconButton>
          )}
        </Tooltip>

        <Tooltip title="Settings">
          <IconButton
            size="small"
            aria-label="Settings"
            onClick={() => {
              setSettingsTab("board");
              setSettingsOpen(true);
            }}
            sx={iconBtnSx}
          >
            <Icon icon="mdi:cog-outline" height={20} />
          </IconButton>
        </Tooltip>

        <Tooltip
          title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
        >
          <IconButton
            size="small"
            aria-label="Switch theme"
            onClick={switchDarkMode}
            sx={iconBtnSx}
          >
            <Icon
              icon={darkMode ? "mdi:weather-sunny" : "mdi:weather-night"}
              height={20}
            />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
