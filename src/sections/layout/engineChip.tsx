import { ENGINE_LABELS } from "@/constants";
import { Stockfish16_1 } from "@/lib/engine/stockfish16_1";
import { isEngineSupported } from "@/lib/engine/shared";
import { probeRecklessBridge } from "@/lib/engine/reckless";
import { EngineName } from "@/types/enums";
import {
  engineNameAtom,
  useCloudEvalAtom,
} from "@/sections/analysis/states";
import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Switch,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { settingsOpenAtom } from "./states";

type BridgeState = "unknown" | "checking" | "up" | "down";

export default function EngineChip() {
  const [engineName, setEngineName] = useAtom(engineNameAtom);
  const [useCloudEval, setUseCloudEval] = useAtom(useCloudEvalAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [bridge, setBridge] = useState<BridgeState>("unknown");
  const theme = useTheme();
  const showLabel = useMediaQuery(theme.breakpoints.up("sm"));

  useEffect(() => {
    if (isEngineSupported(engineName)) return;

    setEngineName(
      Stockfish16_1.isSupported()
        ? EngineName.Stockfish16_1Lite
        : EngineName.Stockfish11
    );
  }, [engineName, setEngineName]);

  const checkBridge = useCallback(async () => {
    setBridge("checking");
    setBridge((await probeRecklessBridge()) ? "up" : "down");
  }, []);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    checkBridge();
  };

  const handleSelect = (name: EngineName) => {
    setEngineName(name);
    setAnchorEl(null);
  };

  const bridgeLabel: Record<BridgeState, string> = {
    unknown: "Local engine via the bridge",
    checking: "Checking the bridge…",
    up: "Bridge running",
    down: "Bridge not running, start it with start-reckless-bridge.bat",
  };

  return (
    <>
      <Tooltip title="Analysis engine">
        <Button
          color="inherit"
          onClick={handleOpen}
          aria-label="Choose analysis engine"
          startIcon={<Icon icon="mdi:chip" height={20} />}
          endIcon={<Icon icon="mdi:chevron-down" height={18} />}
          sx={{
            borderRadius: 5,
            px: showLabel ? 1.5 : 1,
            minWidth: 0,
            border: 1,
            borderColor: "divider",
            "& .MuiButton-startIcon": { mr: showLabel ? 0.75 : 0 },
            "& .MuiButton-endIcon": { ml: showLabel ? 0.5 : 0 },
          }}
        >
          {showLabel ? ENGINE_LABELS[engineName].small : ""}
        </Button>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { width: 340, maxWidth: "94vw" } } }}
      >
        <Typography
          variant="overline"
          sx={{ px: 2, display: "block", opacity: 0.7 }}
        >
          Analysis engine
        </Typography>

        {Object.values(EngineName).map((name) => {
          const isReckless = name === EngineName.Reckless;
          const supported = isEngineSupported(name);

          return (
            <MenuItem
              key={name}
              selected={name === engineName}
              disabled={!supported}
              onClick={() => handleSelect(name)}
            >
              <ListItemIcon>
                <Icon
                  icon={
                    name === engineName
                      ? "mdi:check-circle"
                      : "mdi:circle-outline"
                  }
                  height={20}
                />
              </ListItemIcon>
              <ListItemText
                primary={ENGINE_LABELS[name].full}
                secondary={isReckless ? bridgeLabel[bridge] : undefined}
                slotProps={{
                  secondary: {
                    sx: {
                      color:
                        bridge === "down"
                          ? "error.main"
                          : bridge === "up"
                            ? "success.main"
                            : undefined,
                    },
                  },
                }}
              />
            </MenuItem>
          );
        })}

        <Divider sx={{ my: 1 }} />

        <Box sx={{ px: 2 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={useCloudEval}
                onChange={(_, checked) => setUseCloudEval(checked)}
              />
            }
            label={
              <Typography variant="body2">
                Use Lichess cloud evaluations when available
              </Typography>
            }
          />
          <Typography variant="caption" display="block" sx={{ opacity: 0.7 }}>
            Faster, but those lines come from Lichess, not from the engine
            above. Turn off to always use your engine.
          </Typography>
        </Box>

        <MenuItem
          sx={{ mt: 1 }}
          onClick={() => {
            setAnchorEl(null);
            setSettingsOpen(true);
          }}
        >
          <ListItemIcon>
            <Icon icon="mdi:cog-outline" height={20} />
          </ListItemIcon>
          <ListItemText primary="More settings…" />
        </MenuItem>
      </Menu>
    </>
  );
}
