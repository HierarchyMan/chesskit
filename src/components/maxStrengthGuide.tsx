import {
  HASH_CHOICES,
  MAX_FULL_STRENGTH_MS,
  MIN_FULL_STRENGTH_MS,
  engineHashMbAtom,
  fullStrengthMsAtom,
  nativeThreadsAtom,
  recommendedNativeThreads,
} from "@/lib/engine/engineSettings";
import { engineDepthAtom, useCloudEvalAtom } from "@/sections/analysis/states";
import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useAtom } from "jotai";
import { ReactNode } from "react";

const MAX_STRENGTH = {
  hashMb: 256,
  thinkMs: 10_000,
  depth: 24,
};

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <Stack direction="row" gap={1.5}>
      <Box
        sx={{
          width: 26,
          height: 26,
          flexShrink: 0,
          borderRadius: "50%",
          bgcolor: "primary.main",
          color: "primary.contrastText",
          display: "grid",
          placeItems: "center",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {number}
      </Box>
      <Stack spacing={0.75} sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        {children}
      </Stack>
    </Stack>
  );
}

const Note = ({ children }: { children: ReactNode }) => (
  <Typography variant="body2" sx={{ opacity: 0.8 }}>
    {children}
  </Typography>
);

/** What decides how strong an engine plays here, with the settings that control it. */
export default function MaxStrengthGuide({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [thinkMs, setThinkMs] = useAtom(fullStrengthMsAtom);
  const [hashMb, setHashMb] = useAtom(engineHashMbAtom);
  const [threads, setThreads] = useAtom(nativeThreadsAtom);
  const [depth, setDepth] = useAtom(engineDepthAtom);
  const [cloud, setCloud] = useAtom(useCloudEvalAtom);

  const applyAll = () => {
    setThinkMs(MAX_STRENGTH.thinkMs);
    setHashMb(MAX_STRENGTH.hashMb);
    setThreads(recommendedNativeThreads());
    setDepth(Math.max(depth, MAX_STRENGTH.depth));
    setCloud(false);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Icon icon="mdi:rocket-launch-outline" height={22} />
        Getting maximum strength
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Note>
            An engine&apos;s published rating (CCRL lists Reckless 0.9.0 at 3766
            and Stockfish 19 at 3792) is measured on a native build with enough
            time. Here it reaches that only with the settings below. These
            ratings come from engine-versus-engine games and do not compare to
            human ratings.
          </Note>

          <Step number={1} title="Pick the strongest engine you can run">
            <Note>
              <b>Reckless</b> through the local bridge runs natively and can use
              every core, so it gets closest to its rating. In the browser,{" "}
              <b>Stockfish 19</b> (full network, 95 MB) is strongest, but
              WebAssembly builds use one thread and run slower than native, so
              they play below their listed rating. Lite builds and the
              JavaScript engines are weaker still.
            </Note>
          </Step>

          <Step number={2} title='Set the bot to "Full strength"'>
            <Note>
              In Play or the Arena, choose <b>Full strength</b>, or drag the Elo
              slider to its top (marked Full). Lower Elo values hold the engine
              back on purpose: Stockfish&apos;s own limit stops at 3190, and
              below that the app adds deliberate mistakes.
            </Note>
          </Step>

          <Step number={3} title="Give it time to think">
            <Note>
              At full strength a bot thinks <b>{thinkMs / 1000} s</b> per move.
              More time is stronger, with smaller gains the longer it gets.
            </Note>
            <Box px={1}>
              <Slider
                value={thinkMs}
                min={MIN_FULL_STRENGTH_MS}
                max={MAX_FULL_STRENGTH_MS}
                step={1000}
                valueLabelDisplay="auto"
                valueLabelFormat={(ms) => `${ms / 1000} s`}
                onChange={(_, ms) => setThinkMs(ms as number)}
                aria-label="Think time per move at full strength"
              />
            </Box>
            <Note>
              A game clock overrides this: a clocked bot spends at most about a
              thirtieth of its remaining time on a move, so play untimed or with
              a long clock.
            </Note>
          </Step>

          <Step number={4} title="Give it memory (hash)">
            <Note>
              The hash table remembers positions already searched; long thinks
              need more. Each engine keeps it within what it supports, and every
              analysis thread has its own.
            </Note>
            <Select
              size="small"
              value={HASH_CHOICES.includes(hashMb) ? hashMb : 16}
              onChange={(event) => setHashMb(Number(event.target.value))}
              sx={{ width: 160 }}
              aria-label="Engine hash size"
            >
              {HASH_CHOICES.map((mb) => (
                <MenuItem key={mb} value={mb}>
                  {mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`}
                </MenuItem>
              ))}
            </Select>
          </Step>

          <Step number={5} title="Native engines: use more threads">
            <Note>
              Engines through the bridge can search on several cores at once.
              Browser engines always use one.
            </Note>
            <Box px={1}>
              <Slider
                value={threads}
                min={1}
                max={Math.max(recommendedNativeThreads() + 1, 2)}
                step={1}
                valueLabelDisplay="auto"
                onChange={(_, value) => setThreads(value as number)}
                aria-label="Threads for native engines"
              />
            </Box>
          </Step>

          <Step number={6} title="For analysis: search deeper, use your engine">
            <Note>
              Analysis stops at the search depth set in Settings (now {depth}
              ). Lichess cloud evaluations are fast but come from another engine
              and depth.
            </Note>
            <Stack direction="row" alignItems="center" gap={1}>
              <Switch
                size="small"
                checked={!cloud}
                onChange={(_, checked) => setCloud(!checked)}
              />
              <Typography variant="body2">Always use my own engine</Typography>
            </Stack>
          </Step>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Typography
          variant="caption"
          sx={{ flexGrow: 1, opacity: 0.75, pl: 1 }}
        >
          Applies 10 s per move, 256 MB hash, {recommendedNativeThreads()}{" "}
          threads, depth {Math.max(depth, MAX_STRENGTH.depth)} and no cloud.
        </Typography>
        <Button
          onClick={applyAll}
          startIcon={<Icon icon="mdi:flash" height={18} />}
        >
          Apply all
        </Button>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
