import { Icon } from "@iconify/react";
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import Image from "next/image";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { ActiveModeId, activeModeIndicatorsAtom } from "@/lib/modeLifecycle";
import {
  HOME_ITEM,
  NAV_GROUPS,
  NAV_ITEMS,
  NavItem,
  isNavItemActive,
} from "./navItems";
import { navPreferenceAtom, shortcutsOpenAtom } from "./states";

export const NAV_COLLAPSED_WIDTH = 68;
export const NAV_EXPANDED_WIDTH = 228;

interface Props {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function NavMenu({ mobileOpen, onMobileClose }: Props) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const isNarrow = useMediaQuery("(max-width:1279.95px)");
  const [navPreference, setNavPreference] = useAtom(navPreferenceAtom);
  const activeIndicators = useAtomValue(activeModeIndicatorsAtom);
  const setShortcutsOpen = useSetAtom(shortcutsOpenAtom);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const expanded = isDesktop ? (navPreference ?? !isNarrow) : true;
  const width = expanded ? NAV_EXPANDED_WIDTH : NAV_COLLAPSED_WIDTH;

  const renderItem = (item: NavItem) => {
    const active = isNavItemActive(item, router.pathname);
    const hasSession =
      mounted && Boolean(activeIndicators[item.id as ActiveModeId]);

    const button = (
      <ListItemButton
        component={NextLink}
        prefetch={false}
        href={item.href}
        selected={active}
        onClick={isDesktop ? undefined : onMobileClose}
        sx={{
          position: "relative",
          borderRadius: 1,
          mx: 1,
          my: 0.25,
          minHeight: 38,
          py: 0.5,
          px: expanded ? 1.5 : 0,
          justifyContent: expanded ? "flex-start" : "center",
          color: active ? "text.primary" : "text.secondary",
          "&:hover": {
            color: "text.primary",
            bgcolor: "action.hover",
          },
          "&.Mui-selected": {
            bgcolor: (t) => alpha(t.palette.primary.main, 0.14),
            color: "text.primary",
            "&:hover": {
              bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
            },
            "&::before": {
              content: '""',
              position: "absolute",
              left: 3,
              top: 7,
              bottom: 7,
              width: 3,
              borderRadius: 999,
              bgcolor: "primary.main",
            },
          },
        }}
      >
        <ListItemIcon
          sx={{
            position: "relative",
            minWidth: expanded ? 36 : 0,
            color: active ? "primary.main" : "inherit",
            justifyContent: "center",
          }}
        >
          <Icon icon={item.icon} height={20} />
          {!expanded && hasSession && (
            <Box
              component="span"
              aria-hidden
              sx={{
                position: "absolute",
                top: -2,
                right: -3,
                width: 7,
                height: 7,
                borderRadius: "50%",
                bgcolor: item.accent,
                border: "1.5px solid",
                borderColor: "background.paper",
              }}
            />
          )}
        </ListItemIcon>
        {expanded && (
          <ListItemText
            primary={item.label}
            slotProps={{
              primary: {
                fontSize: "0.875rem",
                fontWeight: active ? 600 : 500,
                noWrap: true,
              },
            }}
          />
        )}
        {expanded && hasSession && (
          <Tooltip title="Session in progress" placement="right">
            <Box
              component="span"
              aria-label="Session in progress"
              sx={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                bgcolor: item.accent,
                flexShrink: 0,
                ml: 1,
                boxShadow: `0 0 0 2px ${alpha(item.accent, 0.22)}`,
              }}
            />
          </Tooltip>
        )}
      </ListItemButton>
    );

    return expanded ? (
      <Box key={item.id}>{button}</Box>
    ) : (
      <Tooltip
        key={item.id}
        title={hasSession ? `${item.label} · Active` : item.label}
        placement="right"
      >
        <Box>{button}</Box>
      </Tooltip>
    );
  };

  const shortcutsButton = (
    <ListItemButton
      aria-label="Keyboard shortcuts"
      onClick={() => {
        if (!isDesktop) onMobileClose();
        setShortcutsOpen(true);
      }}
      sx={{
        borderRadius: 1,
        mx: 1,
        my: 0.25,
        minHeight: 38,
        py: 0.5,
        px: expanded ? 1.5 : 0,
        flexGrow: 0,
        justifyContent: expanded ? "flex-start" : "center",
        color: "text.secondary",
        "&:hover": {
          color: "text.primary",
          bgcolor: "action.hover",
        },
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: expanded ? 36 : 0,
          color: "inherit",
          justifyContent: "center",
        }}
      >
        <Icon icon="mdi:keyboard-outline" height={20} />
      </ListItemIcon>
      {expanded && (
        <ListItemText
          primary="Keyboard shortcuts"
          slotProps={{
            primary: {
              fontSize: "0.875rem",
              fontWeight: 500,
              noWrap: true,
            },
          }}
        />
      )}
    </ListItemButton>
  );

  const content = (
    <Stack height="100%" sx={{ overflowX: "hidden", userSelect: "none" }}>
      <Stack
        direction="row"
        alignItems="center"
        gap={1.25}
        component={NextLink}
        href="/"
        prefetch={false}
        aria-label="Chesskit home"
        sx={{
          px: expanded ? 2 : 0,
          height: 56,
          flexShrink: 0,
          color: "inherit",
          textDecoration: "none",
          borderBottom: 1,
          borderColor: "divider",
          boxSizing: "border-box",
        }}
        justifyContent={expanded ? "flex-start" : "center"}
      >
        <Image
          src="/favicon-32x32.png"
          alt="Chesskit logo"
          width={28}
          height={28}
        />
        {expanded && (
          <Typography variant="h6" fontSize="1.05rem" fontWeight={700} noWrap>
            Chesskit
          </Typography>
        )}
      </Stack>

      <Box
        sx={{ flexGrow: 1, overflowY: "auto", overflowX: "hidden", py: 0.5 }}
      >
        <List disablePadding>{renderItem(HOME_ITEM)}</List>

        {NAV_GROUPS.map((group) => (
          <List
            key={group}
            disablePadding
            subheader={
              expanded ? (
                <ListSubheader
                  disableSticky
                  sx={{
                    background: "transparent",
                    lineHeight: "26px",
                    mt: 0.75,
                    px: 2,
                    textTransform: "uppercase",
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    color: "text.secondary",
                  }}
                >
                  {group}
                </ListSubheader>
              ) : (
                <Box
                  sx={{ mx: 2, my: 0.75, borderTop: 1, borderColor: "divider" }}
                />
              )
            }
          >
            {NAV_ITEMS.filter((item) => item.group === group).map(renderItem)}
          </List>
        ))}
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          borderTop: 1,
          borderColor: "divider",
          pt: 0.5,
          pb: 0.75,
        }}
      >
        {expanded ? (
          shortcutsButton
        ) : (
          <Tooltip title="Keyboard shortcuts (?)" placement="right">
            <Box>{shortcutsButton}</Box>
          </Tooltip>
        )}

        <Stack
          direction={expanded ? "row" : "column"}
          alignItems="center"
          justifyContent={expanded ? "space-between" : "center"}
          gap={0.5}
          sx={{ px: 1.25, pt: 0.25 }}
        >
          <Tooltip
            title="Source on GitHub"
            placement={expanded ? "top" : "right"}
          >
            <IconButton
              size="small"
              aria-label="GitHub"
              component="a"
              href="https://github.com/GuillaumeSD/Chesskit"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: "text.secondary",
                borderRadius: 1,
                "&:hover": { color: "text.primary" },
              }}
            >
              <Icon icon="mdi:github" height={20} />
            </IconButton>
          </Tooltip>

          {isDesktop && (
            <Tooltip
              title={expanded ? "Collapse menu" : "Expand menu"}
              placement={expanded ? "top" : "right"}
            >
              <IconButton
                size="small"
                onClick={() => setNavPreference(!expanded)}
                aria-label={expanded ? "Collapse menu" : "Expand menu"}
                sx={{
                  color: "text.secondary",
                  borderRadius: 1,
                  "&:hover": { color: "text.primary" },
                }}
              >
                <Icon
                  icon={
                    expanded
                      ? "mdi:chevron-double-left"
                      : "mdi:chevron-double-right"
                  }
                  height={20}
                />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>
    </Stack>
  );

  const reservedWidth =
    navPreference === null
      ? {
          width: NAV_COLLAPSED_WIDTH,
          "@media (min-width:1280px)": { width: NAV_EXPANDED_WIDTH },
        }
      : { width };
  return (
    <>
      <Drawer
        variant="temporary"
        open={mobileOpen && !isDesktop}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: false }}
        sx={{ display: { xs: "block", md: "none" } }}
        slotProps={{ paper: { sx: { width: NAV_EXPANDED_WIDTH } } }}
      >
        {content}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          ...reservedWidth,
          display: { xs: "none", md: "block" },
          flexShrink: 0,
          transition: theme.transitions.create("width", {
            duration: theme.transitions.duration.shorter,
          }),
          "& .MuiDrawer-paper": {
            ...reservedWidth,
            display: { xs: "none", md: "block" },
            boxSizing: "border-box",
            overflowX: "hidden",
            transition: theme.transitions.create("width", {
              duration: theme.transitions.duration.shorter,
            }),
          },
        }}
      >
        {content}
      </Drawer>
    </>
  );
}
