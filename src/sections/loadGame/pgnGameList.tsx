import { ParsedGame } from "@/lib/pgn";
import { List, ListItem, ListItemText } from "@mui/material";
import {
  KeyboardEvent,
  ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface Props {
  games: ParsedGame[];
  renderActions: (game: ParsedGame) => ReactNode;
  actionsWidth?: number;
  maxHeight?: number;
}

export default function PgnGameList({
  games,
  renderActions,
  actionsWidth = 120,
  maxHeight = 280,
}: Props) {
  const viewport = useRef<HTMLUListElement>(null);
  const firstRow = useRef<HTMLLIElement>(null);
  const [rowHeight, setRowHeight] = useState(60);
  const [scrollTop, setScrollTop] = useState(0);
  const pendingFocus = useRef<{ row: number; backwards: boolean } | null>(null);
  const moveFocus = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "Tab" || !(event.target instanceof HTMLElement)) return;
    const row = event.target.closest<HTMLElement>("[data-game-row]");
    if (!row) return;
    const buttons = Array.from(
      row.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]")
    );
    const current = buttons.indexOf(event.target);
    if (
      current < 0 ||
      (event.shiftKey ? current !== 0 : current !== buttons.length - 1)
    )
      return;
    let next = Number(row.dataset.gameRow) + (event.shiftKey ? -1 : 1);
    while (games[next]?.error) next += event.shiftKey ? -1 : 1;
    if (next < 0 || next >= games.length || (next >= start && next < end))
      return;
    event.preventDefault();
    pendingFocus.current = { row: next, backwards: event.shiftKey };
    if (viewport.current) viewport.current.scrollTop = next * rowHeight;
    setScrollTop(next * rowHeight);
  };

  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
    setScrollTop(0);
  }, [games]);
  useLayoutEffect(() => {
    const height = firstRow.current?.getBoundingClientRect().height;
    if (height && height !== rowHeight) setRowHeight(height);
  }, [games, rowHeight]);
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
  const end = Math.min(
    games.length,
    start + Math.ceil(maxHeight / rowHeight) + 9
  );
  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    const row = viewport.current?.querySelector(
      `[data-game-row="${pending.row}"]`
    );
    const buttons = row?.querySelectorAll<HTMLElement>(
      "button:not(:disabled), a[href]"
    );
    if (!buttons?.length) return;
    buttons[pending.backwards ? buttons.length - 1 : 0].focus({
      preventScroll: true,
    });
    pendingFocus.current = null;
  }, [start, end]);
  return (
    <List
      ref={viewport}
      onKeyDown={moveFocus}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      dense
      disablePadding
      sx={{
        maxHeight,
        overflowY: "auto",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        width: "100%",
      }}
    >
      {start > 0 && (
        <li
          aria-hidden="true"
          style={{ height: start * rowHeight, listStyle: "none" }}
        />
      )}
      {games.slice(start, end).map((game, index) => (
        <ListItem
          ref={index === 0 ? firstRow : undefined}
          data-game-row={start + index}
          aria-posinset={start + index + 1}
          aria-setsize={games.length}
          key={game.index}
          divider
          secondaryAction={game.error ? undefined : renderActions(game)}
          sx={{ pr: game.error ? 2 : `${actionsWidth + 16}px` }}
        >
          <ListItemText
            primary={
              game.error
                ? `Game ${game.index + 1} could not be read`
                : `${game.white} vs ${game.black}`
            }
            secondary={
              game.error
                ? game.error
                : [
                    game.result,
                    `${Math.ceil(game.movesNb / 2)} moves`,
                    game.date,
                    game.event,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
            slotProps={{
              primary: { noWrap: true },
              secondary: { noWrap: true },
            }}
          />
        </ListItem>
      ))}
      {end < games.length && (
        <li
          aria-hidden="true"
          style={{
            height: (games.length - end) * rowHeight,
            listStyle: "none",
          }}
        />
      )}
    </List>
  );
}
