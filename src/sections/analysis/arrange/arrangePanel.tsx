import { useBoardAppearance } from "@/components/board/appearance";
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
  Chip,
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
import { useEffect, useMemo } from "react";
import { useCopyText } from "@/hooks/useCopyText";
import {
  arrangeHistoryAtom,
  undoArrangeAtom,
  redoArrangeAtom,
} from "../sessionAtoms";
import { SparePiece } from "react-chessboard";
import {
  boardOrientationAtom,
  arrangeBrushAtom,
  editablePositionAtom,
  arrangeFenDraftAtom,
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
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"]'
        )
      )
        return;
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
  }, [undo, redo]);

  const effective = draft === null ? position : parseFenLoose(draft);
  const validation = effective
    ? validatePosition(sanitizePosition(effective))
    : {
        ok: false,
        problems: ["Enter a valid FEN before continuing."],
        warnings: [],
      };
  const fen = effective
    ? positionToFen(sanitizePosition(effective))
    : positionToFen(position);
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
    if (parsed) setPosition(parsed);
    setDraft(null);
  };

  const openElsewhere = (path: string) => {
    setHandoff({ kind: "fen", fen }, path);
    router.push(path);
  };

  const copyFen = () => {
    void copy(fen, "Position FEN");
  };

  return (
    <Stack
      spacing={2.25}
      width="100%"
      sx={{ px: { xs: 0.5, sm: 1 }, userSelect: "none" }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
      >
        <Typography variant="h6" fontWeight={600}>
          Arrange the board
        </Typography>
        <Chip
          size="small"
          color={validation.ok ? "success" : "error"}
          icon={
            <Icon
              icon={
                validation.ok
                  ? "mdi:check-circle-outline"
                  : "mdi:alert-circle-outline"
              }
              height={16}
            />
          }
          label={
            validation.ok
              ? "Valid position"
              : `${validation.problems.length} to fix`
          }
        />
      </Stack>

      <Box>
        <Typography variant="overline" sx={{ opacity: 0.7 }}>
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
              title="Drag onto the board, or click to pick it and then click squares"
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
                borderRadius: 2,
                cursor: "grab",
                border: 2,
                borderColor: brush === code ? "primary.main" : "transparent",
                backgroundColor:
                  brush === code ? "action.selected" : "action.hover",
                "&:hover": { backgroundColor: "action.selected" },
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

        <Stack direction="row" alignItems="center" gap={1} mt={1}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={brush === "hand" || brush === "erase" ? brush : null}
            onChange={(_, value: "hand" | "erase" | null) =>
              setBrush(value ?? "hand")
            }
            aria-label="Board tool"
          >
            <ToggleButton value="hand" aria-label="Move pieces">
              <Icon icon="mdi:hand-back-left-outline" height={18} />
              &nbsp;Move
            </ToggleButton>
            <ToggleButton value="erase" aria-label="Erase pieces">
              <Icon icon="mdi:eraser" height={18} />
              &nbsp;Erase
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Right-click a piece or drag it off the board to remove it.
          </Typography>
        </Stack>
      </Box>

      <Box>
        <Typography variant="overline" sx={{ opacity: 0.7 }}>
          Position
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.75} mt={0.5}>
          <Button
            size="small"
            variant="outlined"
            disabled={!history.past.length}
            onClick={() => undo()}
            startIcon={<Icon icon="mdi:undo" height={18} />}
          >
            Undo
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!history.future.length}
            onClick={() => redo()}
            startIcon={<Icon icon="mdi:redo" height={18} />}
          >
            Redo
          </Button>
          <ToolButton
            icon="mdi:delete-outline"
            label="Clear board"
            onClick={() => setPosition(positionFromFen(EMPTY_FEN))}
          />
          <ToolButton
            icon="mdi:restart"
            label="Starting position"
            onClick={() => setPosition(positionFromFen(START_FEN))}
          />
          <ToolButton
            icon="mdi:swap-vertical-bold"
            label="Swap colours"
            onClick={() =>
              setPosition((current) => sanitizePosition(mirrorColors(current)))
            }
          />
          <ToolButton
            icon="eva:flip-fill"
            label="Flip board"
            onClick={() => setOrientation((value) => !value)}
          />
        </Stack>

        <FormControl size="small" fullWidth sx={{ mt: 1.25 }}>
          <InputLabel id="arrange-preset-label">Load a position</InputLabel>
          <Select
            labelId="arrange-preset-label"
            input={<OutlinedInput label="Load a position" />}
            value=""
            displayEmpty
            onChange={(event) => {
              const preset = POSITION_PRESETS.find(
                (entry) => entry.id === event.target.value
              );
              if (preset) setPosition(positionFromFen(preset.fen));
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
        <Typography variant="overline" sx={{ opacity: 0.7 }}>
          Whose move
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
          sx={{ mt: 0.5 }}
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
            sx={{ minWidth: 150 }}
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

      <TextField
        size="small"
        label="FEN"
        value={draft ?? fen}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") applyDraft();
          if (event.key === "Escape") setDraft(null);
        }}
        error={draftInvalid}
        helperText={
          draftInvalid
            ? "That is not a valid piece placement"
            : "Valid FEN changes appear on the board immediately"
        }
        slotProps={{
          input: {
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

      {validation.problems.map((problem) => (
        <Alert key={problem} severity="error" sx={{ py: 0 }}>
          {problem}
        </Alert>
      ))}
      {validation.warnings.map((warning) => (
        <Alert key={warning} severity="warning" sx={{ py: 0 }}>
          {warning}
        </Alert>
      ))}

      <Stack spacing={1}>
        <Button
          variant="contained"
          size="large"
          disabled={!validation.ok}
          onClick={() => {
            if (effective && finishArrange(effective)) setDraft(null);
          }}
          startIcon={<Icon icon="mdi:play" height={22} />}
        >
          Analyze from here
        </Button>
        <Stack direction="row" gap={1}>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            disabled={!validation.ok}
            onClick={() => openElsewhere("/play")}
          >
            Play it vs a bot
          </Button>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            disabled={!validation.ok}
            onClick={() => openElsewhere("/arena")}
          >
            Engines play it
          </Button>
        </Stack>
      </Stack>
      {feedback}
    </Stack>
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

function ToolButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      size="small"
      variant="outlined"
      color="inherit"
      onClick={onClick}
      startIcon={<Icon icon={icon} height={18} />}
    >
      {label}
    </Button>
  );
}
