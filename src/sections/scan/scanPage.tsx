import MiniBoard from "@/components/board/miniBoard";
import Panel from "@/components/panel";
import { useHandoff } from "@/hooks/useHandoff";
import { positionFromFen, validatePosition } from "@/lib/editorPosition";
import { setHandoff } from "@/lib/handoff";
import { fenToPgn } from "@/lib/pgn";
import { detectBoardGrid, GridRect } from "@/lib/scan/gridDetect";
import {
  LoadedImage,
  loadRawImage,
  readFileAsDataUrl,
} from "@/lib/scan/loadImage";
import { scanBoard } from "@/lib/scan/scanBoard";
import { createSampleBoardImage } from "@/lib/scan/templates";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CircularProgress,
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
import { useRouter } from "next/router";
import {
  CSSProperties,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import GridFrame from "./gridFrame";
import { useShapeTemplates } from "./useShapeTemplates";

type OrientationChoice = "auto" | "white" | "black";

const UNSURE_CONFIDENCE = 0.1;

const defaultGrid = (width: number, height: number): GridRect => {
  const size = Math.round(Math.min(width, height) * 0.8);
  return {
    size,
    x: Math.round((width - size) / 2),
    y: Math.round((height - size) / 2),
  };
};

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const deferredGrid = useDeferredValue(grid);

  const loadSource = useCallback(async (src: string) => {
    setBusy(true);
    setMessage("");

    try {
      const image = await loadRawImage(src);
      setLoaded(image);

      const detected = detectBoardGrid(image.raw);
      setGrid(detected ?? defaultGrid(image.raw.width, image.raw.height));
      setDetection(detected ? "found" : "missed");
      setOrientation("auto");
    } catch (error) {
      console.error(error);
      setMessage("That file could not be read as a picture.");
    } finally {
      setBusy(false);
    }
  }, []);

  const loadFile = useCallback(
    async (file: Blob) => loadSource(await readFileAsDataUrl(file)),
    [loadSource]
  );

  useHandoff(["image"], ({ dataUrl }) => {
    loadSource(dataUrl);
  });

  useEffect(() => {
    const imageFrom = (files: FileList | null | undefined) =>
      Array.from(files ?? []).find((file) => file.type.startsWith("image/"));

    const onPaste = (event: ClipboardEvent) => {
      const file = imageFrom(event.clipboardData?.files);
      if (!file) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      loadFile(file);
    };

    const onDrop = (event: DragEvent) => {
      const file = imageFrom(event.dataTransfer?.files);
      if (!file) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      loadFile(file);
    };

    window.addEventListener("paste", onPaste, true);
    window.addEventListener("drop", onDrop, true);

    return () => {
      window.removeEventListener("paste", onPaste, true);
      window.removeEventListener("drop", onDrop, true);
    };
  }, [loadFile]);

  const outcome = useMemo(
    () =>
      loaded && templates && deferredGrid
        ? scanBoard(
            loaded.raw,
            templates,
            deferredGrid,
            orientation === "auto" ? undefined : orientation === "white"
          )
        : null,
    [loaded, templates, deferredGrid, orientation]
  );

  const fen = useMemo(() => {
    if (!outcome) return "";

    const fields = outcome.position.fen.split(" ");
    fields[1] = turn;
    return fields.join(" ");
  }, [outcome, turn]);

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

  const open = (path: string, asPgn = false) => {
    if (asPgn) setHandoff({ kind: "pgn", pgn: fenToPgn(fen) }, path);
    else setHandoff({ kind: "fen", fen }, path);
    router.push(path);
  };

  const copyFen = () => {
    navigator.clipboard?.writeText?.(fen);
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
    <Box sx={{ maxWidth: 1180, mx: "auto" }}>
      <input
        ref={fileInput}
        type="file"
        hidden
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) loadFile(file);
          event.target.value = "";
        }}
      />

      {!ready && !templateError && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          icon={<CircularProgress size={18} />}
        >
          Preparing piece recognition… {Math.round(progress * 100)}%
          <LinearProgress
            variant="determinate"
            value={progress * 100}
            sx={{ mt: 1 }}
          />
        </Alert>
      )}
      {templateError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {templateError}
        </Alert>
      )}
      {message && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMessage("")}>
          {message}
        </Alert>
      )}

      {!loaded && (
        <Card
          variant="outlined"
          sx={{
            borderStyle: "dashed",
            borderWidth: 2,
            borderColor: "primary.main",
          }}
        >
          <CardActionArea
            onClick={() => fileInput.current?.click()}
            sx={{ p: { xs: 3, sm: 6 } }}
          >
            <Stack alignItems="center" gap={1.5} textAlign="center">
              {busy ? (
                <CircularProgress />
              ) : (
                <Icon
                  icon="mdi:image-search-outline"
                  height={64}
                  color="#3B9AC6"
                />
              )}
              <Typography variant="h5" fontWeight={600}>
                Turn a picture of a board into a position
              </Typography>
              <Typography sx={{ opacity: 0.8, maxWidth: 560 }}>
                Drop a screenshot or a photo here, paste one with Ctrl+V, or
                click to choose a file. The board is found automatically and you
                can adjust the frame if needed.
              </Typography>
              <Button variant="contained" component="span" size="large">
                Choose a picture
              </Button>
            </Stack>
          </CardActionArea>
          <Stack alignItems="center" pb={3}>
            <Button
              onClick={trySample}
              disabled={busy}
              startIcon={<Icon icon="mdi:dice-multiple-outline" height={20} />}
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
              <Alert severity="success" sx={{ py: 0 }}>
                Board found. If the green grid doesn&apos;t line up with the
                squares, drag it, or drag a corner to resize it.
              </Alert>
            )}
            {detection === "missed" && (
              <Alert severity="warning" sx={{ py: 0 }}>
                I couldn&apos;t find the board by myself. Drag the green frame
                onto the board&apos;s outer edge and use the corners to resize
                it.
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
                onClick={() => {
                  const detected = detectBoardGrid(loaded.raw);
                  setGrid(
                    detected ?? defaultGrid(loaded.raw.width, loaded.raw.height)
                  );
                  setDetection(detected ? "found" : "missed");
                }}
              >
                Find the board again
              </Button>
              <Button
                size="small"
                color="inherit"
                startIcon={
                  <Icon icon="mdi:dice-multiple-outline" height={18} />
                }
                onClick={trySample}
                disabled={busy}
              >
                Another sample
              </Button>
            </Stack>
          </Stack>

          <Panel
            title="Detected position"
            sx={{ width: { xs: "100%", md: 400 }, flexShrink: 0 }}
          >
            <Stack spacing={1.75} alignItems="center">
              {outcome ? (
                <>
                  <MiniBoard
                    fen={fen}
                    size={320}
                    animationDuration={0}
                    squareStyles={unsureSquares}
                  />

                  {Object.keys(unsureSquares).length > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ opacity: 0.75, textAlign: "center" }}
                    >
                      Orange squares are the ones I&apos;m least sure about.
                      Check them in the editor.
                    </Typography>
                  )}

                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={orientation}
                    onChange={(_, value: OrientationChoice | null) =>
                      value && setOrientation(value)
                    }
                    aria-label="Which colour is at the bottom of the picture"
                  >
                    <ToggleButton value="auto">
                      Auto ({outcome.position.whiteAtBottom ? "White" : "Black"}{" "}
                      at bottom)
                    </ToggleButton>
                    <ToggleButton value="white">White bottom</ToggleButton>
                    <ToggleButton value="black">Black bottom</ToggleButton>
                  </ToggleButtonGroup>

                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={turn}
                    onChange={(_, value: "w" | "b" | null) =>
                      value && setTurn(value)
                    }
                    aria-label="Whose move it is"
                  >
                    <ToggleButton value="w">White to move</ToggleButton>
                    <ToggleButton value="b">Black to move</ToggleButton>
                  </ToggleButtonGroup>

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
                      {problem} You can fix it in the editor.
                    </Alert>
                  ))}

                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    startIcon={<Icon icon="mdi:pencil-ruler" height={20} />}
                    onClick={() => open("/editor")}
                  >
                    Open in the board editor
                  </Button>
                  <Stack direction="row" gap={1} width="100%">
                    <Button
                      fullWidth
                      size="small"
                      variant="outlined"
                      disabled={!validation?.ok}
                      onClick={() => open("/analysis", true)}
                    >
                      Analyze
                    </Button>
                    <Button
                      fullWidth
                      size="small"
                      variant="outlined"
                      disabled={!validation?.ok}
                      onClick={() => open("/play")}
                    >
                      Play it
                    </Button>
                  </Stack>
                </>
              ) : (
                <Stack alignItems="center" py={4} gap={1}>
                  <CircularProgress size={28} />
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>
                    {ready
                      ? "Reading the board…"
                      : "Waiting for piece recognition to be ready…"}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Panel>
        </Stack>
      )}
    </Box>
  );
}
