import { EnginePickerDialog } from "@/components/enginePicker";
import { engineLabel } from "@/constants";
import { useModels } from "@/hooks/useModels";
import { isEngineSupported, isWasmSupported } from "@/lib/engine/shared";
import { EngineName } from "@/types/enums";
import { engineNameAtom, useCloudEvalAtom } from "@/sections/analysis/states";
import { Icon } from "@iconify/react";
import {
  Box,
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
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { settingsOpenAtom, settingsTabAtom } from "./states";

const ENGINE_CHIP_ROUTES = new Set(["/analysis", "/editor", "/arena"]);

export default function EngineChip() {
  const { pathname } = useRouter();
  const [engineName, setEngineName] = useAtom(engineNameAtom);
  const [useCloudEval, setUseCloudEval] = useAtom(useCloudEvalAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsTab = useSetAtom(settingsTabAtom);
  const { models } = useModels();
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

  if (!ENGINE_CHIP_ROUTES.has(pathname)) return null;

  const view = models.find((entry) => entry.model.name === engineName);

  const needsDownload = !!view && !view.available && view.canDownload;
  const hasError =
    !!view?.error ||
    (!!view && !view.supported) ||
    (view?.model.source === "bridge" && view.bridge === "down") ||
    (!!view && !view.available && !view.canDownload);
  const isAmber =
    !hasError && (!!view?.progress || needsDownload || useCloudEval);

  const dotColor = hasError
    ? "error.main"
    : isAmber
      ? "warning.main"
      : "success.main";

  const statusHint = hasError
    ? "Unavailable"
    : view?.progress
      ? "Downloading…"
      : needsDownload
        ? "Download required"
        : useCloudEval
          ? "Cloud eval enabled"
          : "Ready";

  const openSettings = (tab?: "models") => {
    setOpen(false);
    setSettingsTab(tab ?? "engine");
    setSettingsOpen(true);
  };

  return (
    <>
      <Tooltip
        title={`Analysis engine: ${engineLabel(engineName).full} · ${statusHint}`}
      >
        <Button
          size="small"
          color="inherit"
          onClick={() => setOpen(true)}
          aria-label="Choose analysis engine"
          startIcon={
            <Box
              sx={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Icon icon="mdi:chip" height={18} />
              <Box
                component="span"
                sx={{
                  position: "absolute",
                  right: -2,
                  bottom: -1,
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: dotColor,
                  border: "1.5px solid",
                  borderColor: "background.paper",
                }}
              />
            </Box>
          }
          endIcon={<Icon icon="mdi:chevron-down" height={16} />}
          sx={{
            height: 34,
            borderRadius: 1,
            px: showLabel ? 1.25 : 0.9,
            minWidth: 0,
            border: 1,
            borderColor: "divider",
            "&:hover": {
              bgcolor: "action.hover",
              borderColor: "text.secondary",
            },
            "& .MuiButton-startIcon": { mr: showLabel ? 0.75 : 0 },
            "& .MuiButton-endIcon": { ml: showLabel ? 0.35 : 0.25 },
          }}
        >
          {showLabel ? engineLabel(engineName).small : null}
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
          <Stack spacing={1} sx={{ width: "100%" }}>
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
