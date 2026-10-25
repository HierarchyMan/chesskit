import { Color } from "@/types/enums";
import { Player } from "@/types/game";
import { Avatar, Grid2 as Grid, Stack, Typography } from "@mui/material";
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

  const pgnClock = useMemo(() => {
    const turn = game.turn();

    if (turn === color) {
      const history = game.history({ verbose: true });
      const previousFen = history.at(-1)?.before;

      const comment = game
        .getComments()
        .find(({ fen }) => fen === previousFen)?.comment;

      return getClock(comment);
    }

    const comment = game.getComment();
    return getClock(comment);
  }, [game, color]);

  const clock = liveClockMs !== undefined ? msToClock(liveClockMs) : pgnClock;
  const isLowOnTime = liveClockMs !== undefined && liveClockMs < 10_000;

  return (
    <Grid
      container
      justifyContent="space-between"
      alignItems="center"
      size={12}
      sx={{
        minHeight: 40,
        height: 40,
        flexShrink: 0,
        minWidth: 0,
        userSelect: "none",
        flexWrap: "nowrap",
      }}
    >
      <Stack direction="row" sx={{ minWidth: 0, overflow: "hidden" }}>
        <Avatar
          src={player.avatarUrl}
          alt={player.name}
          variant="circular"
          sx={{
            width: 40,
            height: 40,
            backgroundColor: color === Color.White ? "white" : "black",
            color: color === Color.White ? "black" : "white",
            border: "1px solid black",
          }}
        >
          {player.name[0].toUpperCase()}
        </Avatar>

        <Stack marginLeft={1} sx={{ minWidth: 0 }}>
          <Stack direction="row">
            <Typography fontSize="0.9rem" noWrap>
              {player.name}
            </Typography>

            {player.rating && (
              <Typography marginLeft={0.5} fontSize="0.9rem" fontWeight="200">
                ({player.rating})
              </Typography>
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
          align="center"
          sx={{
            backgroundColor: color === Color.White ? "white" : "black",
            color: isLowOnTime
              ? "#ff6b6b"
              : color === Color.White
                ? "black"
                : "white",
          }}
          borderRadius="5px"
          padding={0.8}
          border="1px solid #424242"
          width="5rem"
          textAlign="right"
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
