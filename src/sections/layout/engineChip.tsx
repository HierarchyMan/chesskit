import { EnginePickerDialog } from "@/components/enginePicker";
import { engineLabel } from "@/constants";
import { isEngineSupported, isWasmSupported } from "@/lib/engine/shared";
import { EngineName } from "@/types/enums";
import { engineNameAtom, useCloudEvalAtom } from "@/sections/analysis/states";
import { Icon } from "@iconify/react";
import {
  Button,
  FormControlLabel,
  Stack,
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
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const showLabel = useMediaQuery(theme.breakpoints.up("sm"));

  useEffect(() => {
    if (isEngineSupported(engineName)) return;

    // Stockfish 19 asm.js is plain JavaScript, so it runs without WebAssembly.
    setEngineName(
      isWasmSupported() ? EngineName.Stockfish19Lite : EngineName.Stockfish19Asm
    );
  }, [engineName, setEngineName]);

  const openSettings = (tab?: "models") => {
    setOpen(false);
    setSettingsTab(tab ?? "engine");
    setSettingsOpen(true);
  };

  return (
    <>
      <Tooltip title="Analysis engine">
        <Button
          color="inherit"
          onClick={() => setOpen(true)}
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
          {showLabel ? engineLabel(engineName).small : ""}
        </Button>
      </Tooltip>

      <EnginePickerDialog
        open={open}
        onClose={() => setOpen(false)}
        value={engineName}
        onSelect={(next) => {
          if (next !== "analysis") setEngineName(next);
        }}
        role="analysis"
        title="Analysis engine"
        footer={
          <Stack spacing={1}>
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
                  Use Lichess cloud evaluations when available (faster, but not
                  from your engine)
                </Typography>
              }
            />
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Button
                size="small"
                startIcon={<Icon icon="mdi:database-outline" height={18} />}
                onClick={() => openSettings("models")}
              >
                Manage downloads
              </Button>
              <Button
                size="small"
                startIcon={<Icon icon="mdi:cog-outline" height={18} />}
                onClick={() => openSettings()}
              >
                Engine settings
              </Button>
            </Stack>
          </Stack>
        }
      />
    </>
  );
}
