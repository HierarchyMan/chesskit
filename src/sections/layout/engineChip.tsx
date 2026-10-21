import { ENGINE_LABELS } from "@/constants";
import { useModels } from "@/hooks/useModels";
import { isEngineSupported, isWasmSupported } from "@/lib/engine/shared";
import { describeModel } from "@/lib/engine/modelStatus";
import { EngineName } from "@/types/enums";
import { engineNameAtom, useCloudEvalAtom } from "@/sections/analysis/states";
import { statusColor } from "@/components/modelMenuLabel";
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
import { useEffect, useState } from "react";
import { settingsOpenAtom, settingsTabAtom } from "./states";

export default function EngineChip() {
  const [engineName, setEngineName] = useAtom(engineNameAtom);
  const [useCloudEval, setUseCloudEval] = useAtom(useCloudEvalAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsTab = useSetAtom(settingsTabAtom);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { models, refresh } = useModels();
  const theme = useTheme();
  const showLabel = useMediaQuery(theme.breakpoints.up("sm"));

  useEffect(() => {
    if (isEngineSupported(engineName)) return;

    setEngineName(
      isWasmSupported() ? EngineName.Stockfish16_1Lite : EngineName.Stockfish11
    );
  }, [engineName, setEngineName]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    void refresh();
  };

  const handleSelect = (name: EngineName) => {
    setEngineName(name);
    setAnchorEl(null);
  };

  const openModels = () => {
    setAnchorEl(null);
    setSettingsTab("models");
    setSettingsOpen(true);
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

        {models.map((view) => {
          const name = view.model.name;
          const status = describeModel(view);

          return (
            <MenuItem
              key={name}
              selected={name === engineName}
              disabled={!view.supported}
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
                secondary={status.text}
                slotProps={{
                  secondary: {
                    sx: {
                      color: statusColor(status.tone),
                      opacity: status.tone === "default" ? 0.75 : 1,
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

        <MenuItem sx={{ mt: 1 }} onClick={openModels}>
          <ListItemIcon>
            <Icon icon="mdi:database-outline" height={20} />
          </ListItemIcon>
          <ListItemText primary="Manage models…" />
        </MenuItem>

        <MenuItem
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
