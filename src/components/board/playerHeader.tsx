import { Color } from "@/types/enums";
import { Player } from "@/types/game";
import { Avatar, Box, Grid2 as Grid, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CapturedPieces from "./capturedPieces";
import { Atom, PrimitiveAtom, atom, useAtomValue } from "jotai";
import { Chess } from "chess.js";
import { useMemo } from "react";
import { getPaddedNumber } from "@/lib/helpers";

export interface Props {
  player: Player;
  color: Color;
  gameAtom: PrimitiveAtom<Chess>;
  clockMsAtom?: Atom<number | undefined>;
  previewFen?: string;
}

const NO_CLOCK_ATOM = atom<number | undefined>(undefined);

const findLastCommentForFen = (
  comments: { fen: string; comment: string }[],
  targetFen: string | undefined
): string | undefined => {
  if (!targetFen) return undefined;
  for (let i = comments.length - 1; i >= 0; i--) {
    if (comments[i].fen === targetFen) return comments[i].comment;
  }
  return undefined;
};

export default function PlayerHeader({
  color,
  player,
  gameAtom,
  previewFen,
  clockMsAtom = NO_CLOCK_ATOM,
}: Props) {
  const game = useAtomValue(gameAtom);
  const liveClockMs = useAtomValue(clockMsAtom);

  const gameFen = game.fen();
  const turn = game.turn();
  const isActiveTurn = !previewFen && !game.isGameOver() && turn === color;

  const pgnClock = useMemo(() => {
    const comments = game.getComments();

    if (turn === color) {
      const history = game.history({ verbose: true });
      const previousFen = history.at(-1)?.before;
      const comment = findLastCommentForFen(comments, previousFen);
      return getClock(comment);
    }

    const currentComment =
      game.getComment() ?? findLastCommentForFen(comments, gameFen);
    return getClock(currentComment);
  }, [game, gameFen, turn, color]);

  const clock = liveClockMs !== undefined ? msToClock(liveClockMs) : pgnClock;
  const isLowOnTime = liveClockMs !== undefined && liveClockMs < 10_000;

  const displayName =
    player.name?.trim() || (color === Color.White ? "White" : "Black");
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Grid
      container
      justifyContent="space-between"
      alignItems="center"
      size={12}
      gap={1}
      sx={{
        height: 44,
        minHeight: 44,
        maxHeight: 44,
        py: 0.25,
        flexShrink: 0,
        minWidth: 0,
        overflow: "hidden",
        userSelect: "none",
        flexWrap: "nowrap",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ minWidth: 0, overflow: "hidden" }}
      >
        <Avatar
          src={player.avatarUrl}
          alt={displayName}
          variant="circular"
          sx={(theme) => ({
            width: 34,
            height: 34,
            fontSize: "0.9rem",
            fontWeight: 700,
            flexShrink: 0,
            backgroundColor: color === Color.White ? "#f3f4f6" : "#26262c",
            color: color === Color.White ? "#18181b" : "#f4f4f5",
            border: "1.5px solid",
            borderColor: isActiveTurn
              ? theme.palette.primary.main
              : theme.palette.divider,
            boxShadow: isActiveTurn
              ? `0 0 0 2px ${alpha(theme.palette.primary.main, 0.25)}`
              : "none",
            transition: "border-color 160ms ease, box-shadow 160ms ease",
          })}
        >
          {initial}
        </Avatar>

        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.6} minWidth={0}>
            {player.title && (
              <Box
                component="span"
                sx={(theme) => ({
                  px: 0.5,
                  py: "1px",
                  borderRadius: "4px",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  lineHeight: 1.25,
                  letterSpacing: "0.02em",
                  flexShrink: 0,
                  bgcolor: alpha(theme.palette.warning.main, 0.16),
                  color:
                    theme.palette.mode === "dark"
                      ? theme.palette.warning.light
                      : theme.palette.warning.dark,
                })}
              >
                {player.title}
              </Box>
            )}

            <Typography
              fontSize="0.88rem"
              fontWeight={isActiveTurn ? 700 : 500}
              lineHeight={1.25}
              noWrap
            >
              {displayName}
            </Typography>

            {player.rating !== undefined && player.rating > 0 && (
              <Typography
                component="span"
                color="text.secondary"
                sx={{
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  lineHeight: 1.25,
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}
              >
                ({player.rating})
              </Typography>
            )}

            {isActiveTurn && !clock && (
              <Box
                aria-label="To move"
                title="To move"
                sx={(theme) => ({
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: theme.palette.primary.main,
                  flexShrink: 0,
                })}
              />
            )}
          </Stack>

          <CapturedPieces
            fen={previewFen ?? gameFen}
            color={color}
            game={previewFen ? undefined : game}
          />
        </Stack>
      </Stack>

      {clock && (
        <Typography
          component="div"
          sx={(theme) => {
            const isWhite = color === Color.White;
            const bg = isLowOnTime
              ? "#dc2626"
              : isWhite
                ? "#f3f4f6"
                : "#26262c";
            const fg = isLowOnTime
              ? "#ffffff"
              : isWhite
                ? "#18181b"
                : "#f4f4f5";
            const borderColor = isLowOnTime
              ? "#b91c1c"
              : isActiveTurn
                ? theme.palette.primary.main
                : isWhite
                  ? "rgba(0, 0, 0, 0.16)"
                  : "rgba(255, 255, 255, 0.14)";
            return {
              backgroundColor: bg,
              color: fg,
              height: 32,
              minWidth: 74,
              px: 1.25,
              borderRadius: 1,
              border: "1.5px solid",
              borderColor,
              boxShadow:
                isActiveTurn && !isLowOnTime
                  ? `0 0 0 2px ${alpha(theme.palette.primary.main, 0.22)}`
                  : "none",
              opacity: isActiveTurn ? 1 : 0.62,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              flexShrink: 0,
              fontSize: "0.92rem",
              fontWeight: 700,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              transition:
                "opacity 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
            };
          }}
        >
          {clock.hours ? `${clock.hours}:` : ""}
          {getPaddedNumber(clock.minutes)}:{getPaddedNumber(clock.seconds)}
          {clock.hours || clock.minutes || clock.seconds > 20
            ? ""
            : `.${clock.tenths}`}
        </Typography>
      )}
    </Grid>
  );
}

const getClock = (comment: string | undefined) => {
  if (!comment) return undefined;

  const match = comment.match(/\[%clk (\d+):(\d+):(\d+)(?:\.(\d*))?\]/);
  if (!match) return undefined;

  return {
    hours: parseInt(match[1]),
    minutes: parseInt(match[2]),
    seconds: parseInt(match[3]),
    tenths: match[4] ? parseInt(match[4]) : 0,
  };
};

const msToClock = (ms: number) => {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);

  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    tenths: Math.floor((clamped % 1000) / 100),
  };
};
