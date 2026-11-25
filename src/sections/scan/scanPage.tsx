import MiniBoard from "@/components/board/miniBoard";
import Panel from "@/components/panel";
import { useHandoff } from "@/hooks/useHandoff";
import { positionFromFen, validatePosition } from "@/lib/editorPosition";
import { setHandoff } from "@/lib/handoff";
import { fenToPgn } from "@/lib/pgn";
import { GridRect } from "@/lib/scan/gridDetect";
import {
  LoadedImage,
  loadRawImage,
  readFileAsDataUrl,
} from "@/lib/scan/loadImage";
import type { ScanOutcome } from "@/lib/scan/scanBoard";
import { ScanProcessor } from "@/lib/scan/processor";
import { createSampleBoardImage } from "@/lib/scan/templates";
import { Color } from "@/types/enums";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useRouter } from "next/router";
import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import GridFrame from "./gridFrame";
import { useShapeTemplates } from "./useShapeTemplates";
import { copyToClipboard } from "@/lib/clipboard";

type OrientationChoice = "auto" | "white" | "black";
type CastlingKey = "K" | "Q" | "k" | "q";

const CASTLING_RIGHTS: { key: CastlingKey; label: string }[] = [
  { key: "K", label: "K" },
  { key: "Q", label: "Q" },
  { key: "k", label: "k" },
  { key: "q", label: "q" },
];

const UNSURE_CONFIDENCE = 0.1;

const defaultGrid = (width: number, height: number): GridRect => {
  const size = Math.round(Math.min(width, height) * 0.8);
  return {
    size,
    x: Math.round((width - size) / 2),
    y: Math.round((height - size) / 2),
  };
};

const parseCastling = (
  field: string | undefined
): Record<CastlingKey, boolean> => ({
  K: !!field?.includes("K"),
  Q: !!field?.includes("Q"),
  k: !!field?.includes("k"),
  q: !!field?.includes("q"),
});

export default function ScanPage() {
  const router = useRouter();
  const { templates, progress, error: templateError } = useShapeTemplates();
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [grid, setGrid] = useState<GridRect | undefined>(undefined);
  const [detection, setDetection] = useState<"idle" | "found" | "missed">(
    "idle"
  );
  const [orientation, setOrientation] = useState<OrientationChoice>("auto");
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [castling, setCastling] = useState<Record<CastlingKey, boolean>>({
    K: true,
    Q: true,
    k: true,
    q: true,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const processor = useRef<ScanProcessor | null>(null);
  const generation = useRef(0);
  const getProcessor = useCallback(() => {
    if (!processor.current || processor.current.disposed)
      processor.current = new ScanProcessor();
    return processor.current;
  }, []);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);

  useEffect(
    () => () => {
      generation.current++;
      processor.current?.dispose();
      processor.current = null;
    },
    []
  );

  const loadSource = useCallback(
    async (src: string) => {
      const request = ++generation.current;
      setBusy(true);
      setMessage("");

      try {
        const image = await loadRawImage(src);
        if (request !== generation.current) return;
        setLoaded(image);
        setGrid(undefined);
        setOutcome(null);
        const detected = await getProcessor().image(image.raw);
        if (request !== generation.current) return;
        setGrid(detected ?? defaultGrid(image.raw.width, image.raw.height));
        setDetection(detected ? "found" : "missed");
        setOrientation("auto");
      } catch (error) {
        console.error(error);
        if (request === generation.current)
          setMessage("That file could not be read as an image.");
      } finally {
        if (request === generation.current) setBusy(false);
      }
    },
    [getProcessor]
  );

  const loadFile = useCallback(
    async (file: Blob) => loadSource(await readFileAsDataUrl(file)),
    [loadSource]
  );

  useHandoff(["image"], ({ dataUrl }) => {
    void loadSource(dataUrl);
  });

  useEffect(() => {
    const imageFrom = (files: FileList | null | undefined) =>
      Array.from(files ?? []).find((file) => file.type.startsWith("image/"));

    const onPaste = (event: ClipboardEvent) => {
      const file = imageFrom(event.clipboardData?.files);
      if (!file) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      void loadFile(file);
    };

    // Handle drop without stopImmediatePropagation in capture phase so
    // GlobalImportListeners always clears its drag overlay cleanly.
    const onDrop = (event: DragEvent) => {
      const file = imageFrom(event.dataTransfer?.files);
      if (!file) return;

      event.preventDefault();
      void loadFile(file);
    };

    window.addEventListener("paste", onPaste, true);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("paste", onPaste, true);
      window.removeEventListener("drop", onDrop);
    };
  }, [loadFile]);

  useEffect(() => {
    if (!loaded || !templates || !grid) return;
    let current = true;
    const frame = requestAnimationFrame(() => {
      void getProcessor()
        .scan(
          templates,
          grid,
          orientation === "auto" ? undefined : orientation === "white"
        )
        .then((result) => {
          if (current && result) {
            setOutcome(result);
            const detectedCastling = result.position.fen.split(" ")[2];
            setCastling(parseCastling(detectedCastling));
          }
        })
        .catch((error) => {
          if (current) setMessage(String(error));
        });
    });
    return () => {
      current = false;
      cancelAnimationFrame(frame);
    };
  }, [loaded, templates, grid, orientation, getProcessor]);

  const effectiveOrientation = useMemo(() => {
    if (orientation === "white") return Color.White;
    if (orientation === "black") return Color.Black;
    return outcome?.position.whiteAtBottom === false
      ? Color.Black
      : Color.White;
  }, [orientation, outcome]);

  const fen = useMemo(() => {
    if (!outcome) return "";

    const fields = outcome.position.fen.split(" ");
    fields[1] = turn;
    const castlingStr =
      CASTLING_RIGHTS.filter(({ key }) => castling[key])
        .map(({ key }) => key)
        .join("") || "-";
    fields[2] = castlingStr;
    return fields.join(" ");
  }, [outcome, turn, castling]);

  const validation = useMemo(
    () => (fen ? validatePosition(positionFromFen(fen)) : undefined),
    [fen]
  );

  const unsureSquares = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (!outcome) return styles;

    for (const [square, confidence] of Object.entries(
      outcome.position.confidences
    )) {
      if (confidence !== undefined && confidence < UNSURE_CONFIDENCE) {
        styles[square] = { backgroundColor: "rgba(255, 140, 0, 0.6)" };
      }
    }
    return styles;
  }, [outcome]);

  const unsureCount = Object.keys(unsureSquares).length;
  const highConfidenceValid = !!validation?.ok && unsureCount === 0;

  const open = (path: string, asPgn = false) => {
    if (asPgn) setHandoff({ kind: "pgn", pgn: fenToPgn(fen) }, path);
    else setHandoff({ kind: "fen", fen }, path);
    void router.push(path);
  };

  const copyFen = async () => {
    if (!(await copyToClipboard(fen))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const trySample = async () => {
    setBusy(true);
    try {
      await loadSource(await createSampleBoardImage());
    } finally {
      setBusy(false);
    }
  };

  const ready = !!templates;

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 1180, mx: "auto", py: 1 }}>
      <Box>
        <Typography variant="h4" fontWeight={700}>
          Scan Board
        </Typography>
        <Typography color="text.secondary">
          Turn a chess screenshot or photo into an editable FEN ready for
          analysis or play.
        </Typography>
      </Box>

      <input
        ref={fileInput}
        type="file"
        hidden
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void loadFile(file);
          event.target.value = "";
        }}
      />

      {!ready && !templateError && (
        <Alert
          severity="info"
          icon={<Icon icon="mdi:image-search-outline" height={20} />}
        >
          Preparing piece recognition… {Math.round(progress * 100)}%
          <LinearProgress
            variant="determinate"
            value={progress * 100}
            sx={{ mt: 1 }}
          />
        </Alert>
      )}
      {templateError && <Alert severity="error">{templateError}</Alert>}
      {message && (
        <Alert severity="error" onClose={() => setMessage("")}>
          {message}
        </Alert>
      )}

      {!loaded && (
        <Card
          variant="outlined"
          sx={(theme) => ({
            borderRadius: "12px",
            borderStyle: "dashed",
            borderWidth: 2,
            borderColor: alpha(theme.palette.primary.main, 0.5),
            bgcolor: alpha(theme.palette.primary.main, 0.06),
          })}
        >
          <CardActionArea
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            sx={{ p: { xs: 3, sm: 6 } }}
          >
            <Stack alignItems="center" gap={1.5} textAlign="center">
              {busy ? (
                <CircularProgress size={44} />
              ) : (
                <Box
                  sx={{
                    color: "primary.main",
                    display: "inline-flex",
                  }}
                >
                  <Icon icon="mdi:image-search-outline" height={56} />
                </Box>
              )}
              <Typography variant="h5" fontWeight={600}>
                Drop, paste, or choose a board image
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 540 }}>
                Drop a screenshot or photo here, paste with Ctrl/⌘+V, or choose
                a file. The board is detected automatically and can be adjusted
                afterward.
              </Typography>
              <Button
                variant="contained"
                component="span"
                size="medium"
                disabled={busy}
                startIcon={<Icon icon="mdi:upload" height={18} />}
              >
                Choose a picture
              </Button>
            </Stack>
          </CardActionArea>
          <Stack alignItems="center" pb={2.5}>
            <Button
              size="small"
              variant="text"
              onClick={trySample}
              disabled={busy}
              startIcon={<Icon icon="mdi:dice-multiple-outline" height={18} />}
            >
              Try a sample board
            </Button>
          </Stack>
        </Card>
      )}

      {loaded && grid && (
        <Stack
          direction={{ xs: "column", md: "row" }}
          gap={3}
          alignItems="flex-start"
        >
          <Stack gap={1.5} sx={{ flex: 1, minWidth: 0, width: "100%" }}>
            {detection === "found" && (
              <Alert severity="success" sx={{ py: 0.25 }}>
                Board detected. Drag the frame or corners if the grid needs
                alignment.
              </Alert>
            )}
            {detection === "missed" && (
              <Alert severity="warning" sx={{ py: 0.25 }}>
                Board could not be detected automatically. Drag the frame onto
                the board&apos;s outer edge and resize the corners.
              </Alert>
            )}

            <GridFrame
              src={loaded.src}
              raw={loaded.raw}
              grid={grid}
              onChange={setGrid}
            />

            <Stack direction="row" gap={1} flexWrap="wrap">
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:upload" height={18} />}
                onClick={() => fileInput.current?.click()}
              >
                Another picture
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<Icon icon="mdi:crosshairs-gps" height={18} />}
                onClick={async () => {
                  const request = generation.current;
                  const detected = await getProcessor().detect();
                  if (request !== generation.current) return;
                  setGrid(
                    detected ?? defaultGrid(loaded.raw.width, loaded.raw.height)
                  );
                  setDetection(detected ? "found" : "missed");
                }}
                sx={{ borderColor: "divider" }}
              >
                Re-detect board
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={
                  <Icon icon="mdi:dice-multiple-outline" height={18} />
                }
                onClick={trySample}
                disabled={busy}
                sx={{ borderColor: "divider" }}
              >
                Try sample
              </Button>
            </Stack>
          </Stack>

          <Panel
            title="Detected position"
            sx={{
              width: { xs: "100%", md: 400 },
              flexShrink: 0,
              borderRadius: "12px",
            }}
          >
            <Stack spacing={1.5} alignItems="center">
              {outcome ? (
                <>
                  <MiniBoard
                    fen={fen}
                    size={320}
                    orientation={effectiveOrientation}
                    showCoordinates={true}
                    animationDuration={0}
                    squareStyles={unsureSquares}
                  />

                  {unsureCount > 0 && (
                    <Typography
                      variant="caption"
                      color="warning.main"
                      textAlign="center"
                    >
                      {unsureCount} highlighted square
                      {unsureCount === 1 ? " has" : "s have"} lower confidence —
                      verify in the board editor.
                    </Typography>
                  )}

                  <Stack spacing={0.5} width="100%">
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        Bottom side
                      </Typography>
                      {orientation === "auto" && (
                        <Typography variant="caption" color="text.secondary">
                          Detected:{" "}
                          {outcome.position.whiteAtBottom ? "White" : "Black"}
                        </Typography>
                      )}
                    </Stack>
                    <ToggleButtonGroup
                      exclusive
                      fullWidth
                      size="small"
                      value={orientation}
                      onChange={(_, value: OrientationChoice | null) =>
                        value && setOrientation(value)
                      }
                      aria-label="Which color is at the bottom of the image"
                    >
                      <ToggleButton value="auto">Auto</ToggleButton>
                      <ToggleButton value="white">White</ToggleButton>
                      <ToggleButton value="black">Black</ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>

                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={turn}
                    onChange={(_, value: "w" | "b" | null) =>
                      value && setTurn(value)
                    }
                    aria-label="Side to move"
                  >
                    <ToggleButton value="w">White to move</ToggleButton>
                    <ToggleButton value="b">Black to move</ToggleButton>
                  </ToggleButtonGroup>

                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    width="100%"
                  >
                    <Typography variant="caption" color="text.secondary">
                      Castling rights
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                      {CASTLING_RIGHTS.map(({ key, label }) => (
                        <FormControlLabel
                          key={key}
                          sx={{ mr: 0.5, ml: 0 }}
                          control={
                            <Checkbox
                              size="small"
                              sx={{ p: 0.5 }}
                              checked={castling[key]}
                              onChange={(event) =>
                                setCastling((prev) => ({
                                  ...prev,
                                  [key]: event.target.checked,
                                }))
                              }
                            />
                          }
                          label={
                            <Typography
                              variant="caption"
                              fontWeight={600}
                              fontFamily="monospace"
                            >
                              {label}
                            </Typography>
                          }
                        />
                      ))}
                    </Stack>
                  </Stack>

                  <TextField
                    size="small"
                    fullWidth
                    label="FEN"
                    value={fen}
                    slotProps={{
                      input: {
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title={copied ? "Copied!" : "Copy FEN"}>
                              <IconButton
                                size="small"
                                onClick={copyFen}
                                aria-label="Copy FEN"
                              >
                                <Icon
                                  icon={
                                    copied ? "mdi:check" : "mdi:content-copy"
                                  }
                                  height={18}
                                />
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />

                  {validation?.problems.map((problem) => (
                    <Alert
                      key={problem}
                      severity="warning"
                      sx={{ py: 0, width: "100%" }}
                    >
                      {problem} Fix this in the board editor.
                    </Alert>
                  ))}

                  {highConfidenceValid ? (
                    <>
                      <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        startIcon={<Icon icon="mdi:chart-line" height={20} />}
                        onClick={() => open("/analysis", true)}
                      >
                        Analyze
                      </Button>
                      <Stack direction="row" gap={1} width="100%">
                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          startIcon={
                            <Icon icon="mdi:pencil-ruler" height={18} />
                          }
                          onClick={() => open("/editor")}
                        >
                          Open in editor
                        </Button>
                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          startIcon={<Icon icon="mdi:chess-pawn" height={18} />}
                          onClick={() => open("/play")}
                        >
                          Play it
                        </Button>
                      </Stack>
                    </>
                  ) : (
                    <>
                      <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        startIcon={<Icon icon="mdi:pencil-ruler" height={20} />}
                        onClick={() => open("/editor")}
                      >
                        Open in editor
                      </Button>
                      <Stack direction="row" gap={1} width="100%">
                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          disabled={!validation?.ok}
                          startIcon={<Icon icon="mdi:chart-line" height={18} />}
                          onClick={() => open("/analysis", true)}
                        >
                          Analyze
                        </Button>
                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          disabled={!validation?.ok}
                          startIcon={<Icon icon="mdi:chess-pawn" height={18} />}
                          onClick={() => open("/play")}
                        >
                          Play it
                        </Button>
                      </Stack>
                    </>
                  )}
                </>
              ) : (
                <Stack alignItems="center" py={4} gap={1}>
                  {ready && <CircularProgress size={28} />}
                  <Typography variant="body2" color="text.secondary">
                    {ready
                      ? "Reading the board…"
                      : "Waiting for piece recognition…"}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Panel>
        </Stack>
      )}
    </Stack>
  );
}
