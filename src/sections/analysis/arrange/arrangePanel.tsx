import { useBoardAppearance } from "@/components/board/appearance";
import type { VerticalWorkspaceSlots } from "@/components/boardWorkspace";
import {
  InspectorDeck,
  InspectorPill,
} from "@/components/inspector/inspectorShell";
import {
  VerticalContextStrip,
  VerticalLiveStrip,
  WorkspaceActionBar,
} from "@/components/inspector/workspaceActionBar";
import ModeSwitch from "./modeSwitch";
import { ToolbarButton } from "@/components/ToolbarButton";
import { setHandoff } from "@/lib/handoff";
import {
  EMPTY_FEN,
  POSITION_PRESETS,
  PIECE_ORDER,
  START_FEN,
  getCastlingAvailability,
  getValidEnPassantSquares,
  mirrorColors,
  parseFenLoose,
  positionFromFen,
  positionToFen,
  sanitizePosition,
  validatePosition,
} from "@/lib/editorPosition";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useCopyText } from "@/hooks/useCopyText";
import {
  arrangeHistoryAtom,
  undoArrangeAtom,
  redoArrangeAtom,
} from "../sessionAtoms";
import { SparePiece } from "react-chessboard";
import { getEngineModel } from "@/lib/engine/models";
import {
  boardOrientationAtom,
  arrangeBrushAtom,
  editablePositionAtom,
  arrangeFenDraftAtom,
  engineNameAtom,
} from "../states";
import { ARRANGE_BOARD_ID } from "./arrangeBoard";
import { useArrangeMode } from "./useArrangeMode";

const PALETTE_PIECE_SIZE = 44;

export default function ArrangePanel() {
  const [position, setPosition] = useAtom(editablePositionAtom);
  const [brush, setBrush] = useAtom(arrangeBrushAtom);
  const setOrientation = useSetAtom(boardOrientationAtom);
  const appearance = useBoardAppearance();
  const router = useRouter();
  const { finishArrange } = useArrangeMode();
  const [draft, setDraft] = useAtom(arrangeFenDraftAtom);
  const { copy, feedback } = useCopyText();
  const history = useAtomValue(arrangeHistoryAtom);
  const undo = useSetAtom(undoArrangeAtom);
  const redo = useSetAtom(redoArrangeAtom);
  const [selectedPreset, setSelectedPreset] = useState("");

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"]'
        )
      ) {
        return;
      }

      if (event.key === "Escape") {
        setBrush("hand");
        return;
      }

      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();
        setOrientation((value) => !value);
        return;
      }

      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [undo, redo, setBrush, setOrientation]);

  const engineName = useAtomValue(engineNameAtom);
  const allowExtraPieces = !!getEngineModel(engineName).supportsExtraPieces;

  const effective = draft === null ? position : parseFenLoose(draft);
  const validation = effective
    ? validatePosition(sanitizePosition(effective), { allowExtraPieces })
    : {
        ok: false,
        problems: ["Enter a valid FEN before continuing."],
        warnings: [],
      };
  const fen = effective
    ? positionToFen(sanitizePosition(effective))
    : positionToFen(position);

  // Sync preset feedback with the live FEN so manual edits clear stale preset selection.
  const activePresetId = useMemo(() => {
    if (!selectedPreset) return "";
    const match = POSITION_PRESETS.find((entry) => entry.id === selectedPreset);
    if (!match) return "";
    const matchFen = positionToFen(
      sanitizePosition(positionFromFen(match.fen))
    );
    return matchFen === fen ? selectedPreset : "";
  }, [selectedPreset, fen]);

  const availableCastling = useMemo(
    () => getCastlingAvailability(position.pieces),
    [position.pieces]
  );
  const enPassantSquares = useMemo(
    () => getValidEnPassantSquares(position),
    [position]
  );
  const draftInvalid = draft !== null && !parseFenLoose(draft);

  const applyDraft = () => {
    if (draft === null) return;

    const parsed = parseFenLoose(draft);
    if (parsed) {
      setPosition(sanitizePosition(parsed));
      setDraft(null);
    }
  };

  const openElsewhere = (path: string) => {
    setHandoff({ kind: "fen", fen, source: "Board editor" }, path);
    void router.push(path);
  };

  const copyFen = () => {
    void copy(fen, "Position FEN");
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        width: "100%",
        userSelect: "none",
      }}
    >
      {/* Compact Status + Position Utility Strip (replaces duplicate header + 5-button pile) */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={0.5}
        sx={{
          px: 1.25,
          py: 0.65,
          minHeight: 40,
          flexShrink: 0,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <InspectorPill
          tone={validation.ok ? "success" : "error"}
          icon={
            validation.ok
              ? "mdi:check-circle-outline"
              : "mdi:alert-circle-outline"
          }
          label={
            validation.ok
              ? "Valid position"
              : `${validation.problems.length} to fix`
          }
        />

        <Stack direction="row" alignItems="center" gap={0.2}>
          <ToolbarButton
            tooltip="Undo (Ctrl/⌘+Z)"
            icon="mdi:undo"
            iconHeight={18}
            disabled={!history.past.length}
            onClick={() => undo()}
          />
          <ToolbarButton
            tooltip="Redo (Ctrl/⌘+Shift+Z)"
            icon="mdi:redo"
            iconHeight={18}
            disabled={!history.future.length}
            onClick={() => redo()}
          />
          <ToolbarButton
            tooltip="Flip board (F)"
            icon="mdi:swap-vertical"
            iconHeight={18}
            onClick={() => setOrientation((value) => !value)}
          />
          <ToolbarButton
            tooltip="Swap colors"
            icon="mdi:swap-vertical-bold"
            iconHeight={18}
            onClick={() => {
              setSelectedPreset("");
              setPosition((current) => sanitizePosition(mirrorColors(current)));
            }}
          />
          <ToolbarButton
            tooltip="Reset to starting position"
            icon="mdi:restart"
            iconHeight={18}
            onClick={() => {
              setSelectedPreset("");
              setPosition(positionFromFen(START_FEN));
            }}
          />
          <ToolbarButton
            tooltip="Clear board"
            icon="mdi:delete-outline"
            iconHeight={18}
            onClick={() => {
              setSelectedPreset("");
              setPosition(positionFromFen(EMPTY_FEN));
            }}
          />
        </Stack>
      </Stack>

      {/* Scrollable editor controls */}
      <Box
        data-inspector-scroller
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overscrollBehavior: "contain",
          scrollbarGutter: "stable",
          p: 1.5,
        }}
      >
        <Stack spacing={2} width="100%">
          {/* Validation errors & warnings surfaced right at the top */}
          {(validation.problems.length > 0 ||
            validation.warnings.length > 0) && (
            <Stack spacing={0.75}>
              {validation.problems.map((problem) => (
                <Alert key={problem} severity="error" sx={{ py: 0.25 }}>
                  {problem}
                </Alert>
              ))}
              {validation.warnings.map((warning) => (
                <Alert key={warning} severity="warning" sx={{ py: 0.25 }}>
                  {warning}
                </Alert>
              ))}
            </Stack>
          )}

          {/* Piece Palette */}
          <Box>
            <Typography variant="overline" color="text.secondary">
              Pieces
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 0.5,
                mt: 0.5,
              }}
            >
              {PIECE_ORDER.map((code) => (
                <Box
                  key={code}
                  role="button"
                  tabIndex={0}
                  aria-label={`${code[0] === "w" ? "White" : "Black"} ${PIECE_NAMES[code[1]]}`}
                  aria-pressed={brush === code}
                  title="Drag onto the board, or select and click squares (click same piece again to remove)"
                  onClick={() => setBrush(brush === code ? "hand" : code)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setBrush(brush === code ? "hand" : code);
                    }
                  }}
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    borderRadius: 1,
                    cursor: "grab",
                    border: 2,
                    borderColor:
                      brush === code ? "primary.main" : "transparent",
                    backgroundColor:
                      brush === code ? "action.selected" : "action.hover",
                    "&:hover": { backgroundColor: "action.selected" },
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                    },
                  }}
                >
                  <SparePiece
                    piece={code}
                    width={PALETTE_PIECE_SIZE}
                    dndId={ARRANGE_BOARD_ID}
                    customPieceJSX={appearance.customPieces[code]}
                  />
                </Box>
              ))}
            </Box>

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              mt={1}
              flexWrap="wrap"
            >
              <ToggleButtonGroup
                exclusive
                size="small"
                value={brush === "hand" || brush === "erase" ? brush : null}
                onChange={(_, value: "hand" | "erase" | null) =>
                  setBrush(value ?? "hand")
                }
                aria-label="Board tool"
                sx={{
                  "& .MuiToggleButton-root": {
                    py: 0.4,
                    px: 1.25,
                    minHeight: 32,
                    textTransform: "none",
                  },
                }}
              >
                <ToggleButton value="hand" aria-label="Move pieces (Esc)">
                  <Icon icon="mdi:hand-back-left-outline" height={17} />
                  &nbsp;Move
                </ToggleButton>
                <ToggleButton value="erase" aria-label="Erase pieces">
                  <Icon icon="mdi:eraser" height={17} />
                  &nbsp;Erase
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary">
                Right-click or drag off board to remove · Esc for Move · F to
                flip
              </Typography>
            </Stack>
          </Box>

          {/* Preset Picker */}
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.4 }}
            >
              Preset
            </Typography>
            <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
              <InputLabel id="arrange-preset-label">Load a preset</InputLabel>
              <Select
                labelId="arrange-preset-label"
                input={<OutlinedInput label="Load a preset" />}
                value={activePresetId}
                onChange={(event) => {
                  const id = event.target.value;
                  const preset = POSITION_PRESETS.find(
                    (entry) => entry.id === id
                  );
                  if (preset) {
                    setSelectedPreset(preset.id);
                    setPosition(positionFromFen(preset.fen));
                  }
                }}
              >
                {POSITION_PRESETS.map((preset) => (
                  <MenuItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Position Rules */}
          <Box>
            <Typography variant="overline" color="text.secondary">
              Position rules
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={position.turn}
              onChange={(_, value: "w" | "b" | null) => {
                if (value)
                  setPosition((current) =>
                    sanitizePosition({ ...current, turn: value })
                  );
              }}
              sx={{
                mt: 0.5,
                "& .MuiToggleButton-root": {
                  minHeight: 32,
                  textTransform: "none",
                },
              }}
            >
              <ToggleButton value="w">White to move</ToggleButton>
              <ToggleButton value="b">Black to move</ToggleButton>
            </ToggleButtonGroup>

            <Stack direction="row" flexWrap="wrap" columnGap={2} mt={1}>
              {(
                [
                  ["K", "White O-O"],
                  ["Q", "White O-O-O"],
                  ["k", "Black O-O"],
                  ["q", "Black O-O-O"],
                ] as const
              ).map(([key, label]) => (
                <FormControlLabel
                  key={key}
                  label={<Typography variant="body2">{label}</Typography>}
                  control={
                    <Checkbox
                      size="small"
                      checked={position.castling[key]}
                      disabled={!availableCastling[key]}
                      onChange={(_, checked) =>
                        setPosition((current) =>
                          sanitizePosition({
                            ...current,
                            castling: { ...current.castling, [key]: checked },
                          })
                        )
                      }
                    />
                  }
                />
              ))}
            </Stack>

            <Stack direction="row" gap={1.5} mt={1}>
              <FormControl
                size="small"
                sx={{ minWidth: 140 }}
                disabled={!enPassantSquares.length}
              >
                <InputLabel id="arrange-ep-label" shrink>
                  En passant
                </InputLabel>
                <Select
                  labelId="arrange-ep-label"
                  input={<OutlinedInput label="En passant" notched />}
                  value={position.enPassant ?? ""}
                  displayEmpty
                  onChange={(event) =>
                    setPosition((current) =>
                      sanitizePosition({
                        ...current,
                        enPassant: (event.target.value ||
                          null) as typeof current.enPassant,
                      })
                    )
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  {enPassantSquares.map((square) => (
                    <MenuItem key={square} value={square}>
                      {square}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                size="small"
                type="number"
                label="Move number"
                value={position.fullmove}
                onChange={(event) =>
                  setPosition((current) => ({
                    ...current,
                    fullmove: Math.max(
                      1,
                      Math.round(Number(event.target.value) || 1)
                    ),
                  }))
                }
                slotProps={{ htmlInput: { min: 1, max: 999 } }}
                sx={{ width: 130 }}
              />
            </Stack>
          </Box>

          {/* Live FEN Input */}
          <TextField
            size="small"
            label="FEN"
            value={draft ?? fen}
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              const parsed = parseFenLoose(value);
              if (parsed) {
                setSelectedPreset("");
                setPosition(sanitizePosition(parsed));
              }
            }}
            onBlur={applyDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyDraft();
                (event.target as HTMLInputElement).blur();
              }
              if (event.key === "Escape") setDraft(null);
            }}
            error={draftInvalid}
            helperText={
              draftInvalid
                ? "That is not a valid piece placement"
                : "Valid FEN changes update the board immediately"
            }
            slotProps={{
              input: {
                sx: { fontFamily: "monospace", fontSize: "0.8rem" },
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Copy FEN">
                      <IconButton
                        size="small"
                        onClick={copyFen}
                        aria-label="Copy FEN"
                        disabled={draftInvalid}
                      >
                        <Icon icon="mdi:content-copy" height={18} />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Stack>
      </Box>

      {/* Pinned Sticky Primary Action Footer */}
      <InspectorDeck sx={{ p: 1.25 }}>
        <Stack spacing={0.85}>
          <Button
            variant="contained"
            size="medium"
            fullWidth
            disabled={!validation.ok}
            onClick={() => {
              if (effective && finishArrange(effective)) setDraft(null);
            }}
            startIcon={<Icon icon="mdi:chart-line" height={18} />}
          >
            Analyze from here
          </Button>
          <Stack direction="row" gap={0.85}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              disabled={!validation.ok}
              startIcon={<Icon icon="mdi:chess-pawn" height={16} />}
              onClick={() => openElsewhere("/play")}
            >
              Play vs bot
            </Button>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              disabled={!validation.ok}
              startIcon={<Icon icon="mdi:sword-cross" height={16} />}
              onClick={() => openElsewhere("/arena")}
            >
              Arena
            </Button>
          </Stack>
        </Stack>
      </InspectorDeck>

      {feedback}
    </Box>
  );
}

const PIECE_NAMES: Record<string, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

/**
 * Vertical workspace slots for Board Editor / Arrange mode:
 * keeps status + quick undo/flip/reset/clear above the board, attaches the 2×6 Piece Palette
 * + Move/Erase tools directly beneath the board, pins Analyze/Play/Arena in the bottom thumb bar,
 * and places Presets, Position rules, and FEN cleanly below the fold.
 */
export function useArrangeVerticalSlots(): VerticalWorkspaceSlots {
  const [position, setPosition] = useAtom(editablePositionAtom);
  const [brush, setBrush] = useAtom(arrangeBrushAtom);
  const setOrientation = useSetAtom(boardOrientationAtom);
  const appearance = useBoardAppearance();
  const router = useRouter();
  const { finishArrange } = useArrangeMode();
  const [draft, setDraft] = useAtom(arrangeFenDraftAtom);
  const { copy, feedback } = useCopyText();
  const history = useAtomValue(arrangeHistoryAtom);
  const undo = useSetAtom(undoArrangeAtom);
  const redo = useSetAtom(redoArrangeAtom);
  const [selectedPreset, setSelectedPreset] = useState("");

  const engineName = useAtomValue(engineNameAtom);
  const allowExtraPieces = !!getEngineModel(engineName).supportsExtraPieces;

  const effective = draft === null ? position : parseFenLoose(draft);
  const validation = effective
    ? validatePosition(sanitizePosition(effective), { allowExtraPieces })
    : {
        ok: false,
        problems: ["Enter a valid FEN before continuing."],
        warnings: [],
      };
  const fen = effective
    ? positionToFen(sanitizePosition(effective))
    : positionToFen(position);

  const activePresetId = useMemo(() => {
    if (!selectedPreset) return "";
    const match = POSITION_PRESETS.find((entry) => entry.id === selectedPreset);
    if (!match) return "";
    const matchFen = positionToFen(
      sanitizePosition(positionFromFen(match.fen))
    );
    return matchFen === fen ? selectedPreset : "";
  }, [selectedPreset, fen]);

  const availableCastling = useMemo(
    () => getCastlingAvailability(position.pieces),
    [position.pieces]
  );
  const enPassantSquares = useMemo(
    () => getValidEnPassantSquares(position),
    [position]
  );
  const draftInvalid = draft !== null && !parseFenLoose(draft);

  const applyDraft = () => {
    if (draft === null) return;
    const parsed = parseFenLoose(draft);
    if (parsed) {
      setPosition(sanitizePosition(parsed));
      setDraft(null);
    }
  };

  const openElsewhere = (path: string) => {
    setHandoff({ kind: "fen", fen, source: "Board editor" }, path);
    void router.push(path);
  };

  return {
    reserveHeight: 235,
    contextBar: (
      <VerticalContextStrip
        left={
          <InspectorPill
            tone={validation.ok ? "success" : "error"}
            icon={
              validation.ok
                ? "mdi:check-circle-outline"
                : "mdi:alert-circle-outline"
            }
            label={
              validation.ok ? "Valid" : `${validation.problems.length} to fix`
            }
          />
        }
        right={
          <>
            <ToolbarButton
              tooltip="Undo"
              icon="mdi:undo"
              iconHeight={18}
              disabled={!history.past.length}
              onClick={() => undo()}
            />
            <ToolbarButton
              tooltip="Redo"
              icon="mdi:redo"
              iconHeight={18}
              disabled={!history.future.length}
              onClick={() => redo()}
            />
            <ToolbarButton
              tooltip="Flip board"
              icon="mdi:swap-vertical"
              iconHeight={18}
              onClick={() => setOrientation((value) => !value)}
            />
            <ToolbarButton
              tooltip="Reset to start"
              icon="mdi:restart"
              iconHeight={18}
              onClick={() => {
                setSelectedPreset("");
                setPosition(positionFromFen(START_FEN));
              }}
            />
            <ToolbarButton
              tooltip="Clear board"
              icon="mdi:delete-outline"
              iconHeight={18}
              onClick={() => {
                setSelectedPreset("");
                setPosition(positionFromFen(EMPTY_FEN));
              }}
            />
            <ModeSwitch />
          </>
        }
      />
    ),
    liveStrip: (
      <VerticalLiveStrip minHeight={116} sx={{ px: 1, py: 0.75 }}>
        <Stack spacing={0.75}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 0.5,
            }}
          >
            {PIECE_ORDER.map((code) => (
              <Box
                key={code}
                role="button"
                tabIndex={0}
                aria-label={`${code[0] === "w" ? "White" : "Black"} ${PIECE_NAMES[code[1]]}`}
                aria-pressed={brush === code}
                onClick={() => setBrush(brush === code ? "hand" : code)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setBrush(brush === code ? "hand" : code);
                  }
                }}
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 1,
                  cursor: "pointer",
                  border: 2,
                  borderColor: brush === code ? "primary.main" : "transparent",
                  backgroundColor:
                    brush === code ? "action.selected" : "action.hover",
                  minHeight: 40,
                }}
              >
                <SparePiece
                  piece={code}
                  width={36}
                  dndId={ARRANGE_BOARD_ID}
                  customPieceJSX={appearance.customPieces[code]}
                />
              </Box>
            ))}
          </Box>

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={0.75}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={brush === "hand" || brush === "erase" ? brush : null}
              onChange={(_, value: "hand" | "erase" | null) =>
                setBrush(value ?? "hand")
              }
              aria-label="Board tool"
              sx={{
                "& .MuiToggleButton-root": {
                  py: 0.3,
                  px: 1,
                  minHeight: 34,
                  fontSize: "0.76rem",
                  textTransform: "none",
                },
              }}
            >
              <ToggleButton value="hand">
                <Icon icon="mdi:hand-back-left-outline" height={16} />
                &nbsp;Move
              </ToggleButton>
              <ToggleButton value="erase">
                <Icon icon="mdi:eraser" height={16} />
                &nbsp;Erase
              </ToggleButton>
            </ToggleButtonGroup>

            <Stack direction="row" alignItems="center" gap={0.5}>
              <ToolbarButton
                tooltip="Swap colors"
                icon="mdi:swap-vertical-bold"
                iconHeight={18}
                onClick={() => {
                  setSelectedPreset("");
                  setPosition((current) =>
                    sanitizePosition(mirrorColors(current))
                  );
                }}
              />
              <ToggleButtonGroup
                exclusive
                size="small"
                value={position.turn}
                onChange={(_, value: "w" | "b" | null) => {
                  if (value)
                    setPosition((current) =>
                      sanitizePosition({ ...current, turn: value })
                    );
                }}
                sx={{
                  "& .MuiToggleButton-root": {
                    py: 0.25,
                    px: 0.85,
                    minHeight: 34,
                    fontSize: "0.74rem",
                    textTransform: "none",
                  },
                }}
              >
                <ToggleButton value="w">White</ToggleButton>
                <ToggleButton value="b">Black</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>

          {validation.problems.length > 0 && (
            <Typography
              variant="caption"
              color="error.main"
              fontWeight={600}
              noWrap
            >
              {validation.problems[0]}
            </Typography>
          )}
        </Stack>
      </VerticalLiveStrip>
    ),
    actionBar: (
      <>
        <WorkspaceActionBar>
          <Button
            variant="contained"
            size="small"
            disabled={!validation.ok}
            onClick={() => {
              if (effective && finishArrange(effective)) setDraft(null);
            }}
            startIcon={<Icon icon="mdi:chart-line" height={17} />}
            sx={{ flex: 1, minHeight: 38, fontWeight: 700 }}
          >
            Analyze
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!validation.ok}
            startIcon={<Icon icon="mdi:chess-pawn" height={16} />}
            onClick={() => openElsewhere("/play")}
            sx={{ minHeight: 38, px: 1.25 }}
          >
            Play
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!validation.ok}
            startIcon={<Icon icon="mdi:sword-cross" height={16} />}
            onClick={() => openElsewhere("/arena")}
            sx={{ minHeight: 38, px: 1.25 }}
          >
            Arena
          </Button>
        </WorkspaceActionBar>
        {feedback}
      </>
    ),
    sheet: (
      <Stack spacing={2} sx={{ p: 1.5 }}>
        {(validation.problems.length > 0 || validation.warnings.length > 0) && (
          <Stack spacing={0.75}>
            {validation.problems.map((problem) => (
              <Alert key={problem} severity="error" sx={{ py: 0.25 }}>
                {problem}
              </Alert>
            ))}
            {validation.warnings.map((warning) => (
              <Alert key={warning} severity="warning" sx={{ py: 0.25 }}>
                {warning}
              </Alert>
            ))}
          </Stack>
        )}

        <Typography variant="caption" color="text.secondary">
          Tap a piece above, then tap squares on the board to place or remove.
        </Typography>

        <Box>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.4 }}
          >
            Preset
          </Typography>
          <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
            <InputLabel id="arrange-preset-vertical-label">
              Load a preset
            </InputLabel>
            <Select
              labelId="arrange-preset-vertical-label"
              input={<OutlinedInput label="Load a preset" />}
              value={activePresetId}
              onChange={(event) => {
                const id = event.target.value;
                const preset = POSITION_PRESETS.find(
                  (entry) => entry.id === id
                );
                if (preset) {
                  setSelectedPreset(preset.id);
                  setPosition(positionFromFen(preset.fen));
                }
              }}
            >
              {POSITION_PRESETS.map((preset) => (
                <MenuItem key={preset.id} value={preset.id}>
                  {preset.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary">
            Position rules
          </Typography>
          <Stack direction="row" flexWrap="wrap" columnGap={2} mt={0.5}>
            {(
              [
                ["K", "White O-O"],
                ["Q", "White O-O-O"],
                ["k", "Black O-O"],
                ["q", "Black O-O-O"],
              ] as const
            ).map(([key, label]) => (
              <FormControlLabel
                key={key}
                label={<Typography variant="body2">{label}</Typography>}
                control={
                  <Checkbox
                    size="small"
                    checked={position.castling[key]}
                    disabled={!availableCastling[key]}
                    onChange={(_, checked) =>
                      setPosition((current) =>
                        sanitizePosition({
                          ...current,
                          castling: { ...current.castling, [key]: checked },
                        })
                      )
                    }
                  />
                }
              />
            ))}
          </Stack>

          <Stack direction="row" gap={1.5} mt={1}>
            <FormControl
              size="small"
              sx={{ minWidth: 130, flex: 1 }}
              disabled={!enPassantSquares.length}
            >
              <InputLabel id="arrange-ep-vertical-label" shrink>
                En passant
              </InputLabel>
              <Select
                labelId="arrange-ep-vertical-label"
                input={<OutlinedInput label="En passant" notched />}
                value={position.enPassant ?? ""}
                displayEmpty
                onChange={(event) =>
                  setPosition((current) =>
                    sanitizePosition({
                      ...current,
                      enPassant: (event.target.value ||
                        null) as typeof current.enPassant,
                    })
                  )
                }
              >
                <MenuItem value="">None</MenuItem>
                {enPassantSquares.map((square) => (
                  <MenuItem key={square} value={square}>
                    {square}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              type="number"
              label="Move number"
              value={position.fullmove}
              onChange={(event) =>
                setPosition((current) => ({
                  ...current,
                  fullmove: Math.max(
                    1,
                    Math.round(Number(event.target.value) || 1)
                  ),
                }))
              }
              slotProps={{ htmlInput: { min: 1, max: 999 } }}
              sx={{ width: 120 }}
            />
          </Stack>
        </Box>

        <TextField
          size="small"
          label="FEN"
          value={draft ?? fen}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            const parsed = parseFenLoose(value);
            if (parsed) {
              setSelectedPreset("");
              setPosition(sanitizePosition(parsed));
            }
          }}
          onBlur={applyDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applyDraft();
              (event.target as HTMLInputElement).blur();
            }
            if (event.key === "Escape") setDraft(null);
          }}
          error={draftInvalid}
          helperText={
            draftInvalid
              ? "That is not a valid piece placement"
              : "Valid FEN changes update the board immediately"
          }
          slotProps={{
            input: {
              sx: { fontFamily: "monospace", fontSize: "0.8rem" },
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Copy FEN">
                    <IconButton
                      size="small"
                      onClick={() => void copy(fen, "Position FEN")}
                      aria-label="Copy FEN"
                      disabled={draftInvalid}
                    >
                      <Icon icon="mdi:content-copy" height={18} />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>
    ),
  };
}
