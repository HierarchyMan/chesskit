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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useAtom } from "jotai";
import Image from "next/image";
import NextLink from "next/link";
import { useRouter } from "next/router";
import {
  HOME_ITEM,
  NAV_GROUPS,
  NAV_ITEMS,
  NavItem,
  isNavItemActive,
} from "./navItems";
import { navExpandedAtom } from "./states";

export const NAV_COLLAPSED_WIDTH = 68;
export const NAV_EXPANDED_WIDTH = 228;

interface Props {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function NavMenu({ mobileOpen, onMobileClose }: Props) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [navExpanded, setNavExpanded] = useAtom(navExpandedAtom);
  const router = useRouter();

  const expanded = isDesktop ? navExpanded : true;
  const width = expanded ? NAV_EXPANDED_WIDTH : NAV_COLLAPSED_WIDTH;

  const renderItem = (item: NavItem) => {
    const active = isNavItemActive(item, router.pathname);

    const button = (
      <ListItemButton
        component={NextLink}
        href={item.href}
        selected={active}
        onClick={isDesktop ? undefined : onMobileClose}
        sx={{
          borderRadius: 2,
          mx: 1,
          my: 0.25,
          minHeight: 44,
          px: 1.5,
          justifyContent: expanded ? "flex-start" : "center",
          borderLeft: "3px solid",
          borderLeftColor: active ? item.accent : "transparent",
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: expanded ? 38 : 0,
            color: active ? item.accent : "inherit",
            justifyContent: "center",
          }}
        >
          <Icon icon={item.icon} height={22} />
        </ListItemIcon>
        {expanded && (
          <ListItemText
            primary={item.label}
            slotProps={{
              primary: { fontSize: "0.95rem", fontWeight: active ? 600 : 400 },
            }}
          />
        )}
      </ListItemButton>
    );

    return expanded ? (
      <Box key={item.id}>{button}</Box>
    ) : (
      <Tooltip key={item.id} title={item.label} placement="right">
        <Box>{button}</Box>
      </Tooltip>
    );
  };

  const content = (
    <Stack height="100%" sx={{ overflowX: "hidden" }}>
      <Stack
        direction="row"
        alignItems="center"
        gap={1.2}
        sx={{ px: expanded ? 2.5 : 0, height: 56, flexShrink: 0 }}
        justifyContent={expanded ? "flex-start" : "center"}
      >
        <Image
          src="/favicon-32x32.png"
          alt="Chesskit logo"
          width={30}
          height={30}
        />
        {expanded && (
          <Typography variant="h6" fontWeight={700} noWrap>
            Chesskit
          </Typography>
        )}
      </Stack>

      <Box sx={{ flexGrow: 1, overflowY: "auto", overflowX: "hidden" }}>
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
                    lineHeight: "30px",
                    mt: 1,
                    textTransform: "uppercase",
                    fontSize: "0.7rem",
                    letterSpacing: "0.08em",
                  }}
                >
                  {group}
                </ListSubheader>
              ) : (
                <Box
                  sx={{ mx: 2, my: 1, borderTop: 1, borderColor: "divider" }}
                />
              )
            }
          >
            {NAV_ITEMS.filter((item) => item.group === group).map(renderItem)}
          </List>
        ))}
      </Box>

      {isDesktop && (
        <Stack
          alignItems={expanded ? "flex-end" : "center"}
          sx={{ p: 1, flexShrink: 0 }}
        >
          <Tooltip
            title={expanded ? "Collapse menu" : "Expand menu"}
            placement="right"
          >
            <IconButton
              size="small"
              onClick={() => setNavExpanded((value) => !value)}
              aria-label={expanded ? "Collapse menu" : "Expand menu"}
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
        </Stack>
      )}
    </Stack>
  );

  if (!isDesktop) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: false }}
        slotProps={{ paper: { sx: { width: NAV_EXPANDED_WIDTH } } }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        transition: theme.transitions.create("width", {
          duration: theme.transitions.duration.shorter,
        }),
        "& .MuiDrawer-paper": {
          width,
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
  );
}
