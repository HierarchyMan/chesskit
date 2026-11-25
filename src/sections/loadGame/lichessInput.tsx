import { useLocalStorage } from "@/hooks/useLocalStorage";
import { getLichessUserRecentGames } from "@/lib/lichess";
import {
  Alert,
  Autocomplete,
  Box,
  CircularProgress,
  FormControl,
  IconButton,
  List,
  Stack,
  TextField,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { GameItem } from "./gameItem";

interface Props {
  onSelect: (pgn: string, boardOrientation?: boolean) => void;
}

export default function LichessInput({ onSelect }: Props) {
  const [rawStoredValue, setStoredValues] = useLocalStorage<string>(
    "lichess-username",
    ""
  );
  const [lichessUsername, setLichessUsername] = useState("");
  const [hasEdited, setHasEdited] = useState(false);

  const storedValues = useMemo(() => {
    if (typeof rawStoredValue === "string") {
      return rawStoredValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [rawStoredValue]);

  useEffect(() => {
    if (hasEdited || !storedValues.length) return;
    const first = storedValues[0].trim();
    if (lichessUsername.trim().toLowerCase() !== first.toLowerCase()) {
      setLichessUsername(first);
    }
  }, [hasEdited, storedValues, lichessUsername]);

  const updateHistory = (username: string) => {
    const trimmed = username.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();

    const updated = [
      trimmed,
      ...storedValues.filter((u) => u.toLowerCase() !== lower),
    ].slice(0, 8);

    setStoredValues(updated.join(","));
  };

  const deleteUsername = (usernameToDelete: string) => {
    const updated = storedValues.filter((u) => u !== usernameToDelete);
    setStoredValues(updated.join(","));
  };

  const handleChange = (_: React.SyntheticEvent, newValue: string | null) => {
    const newInputValue = newValue ?? "";
    setLichessUsername(newInputValue.trim());
    setHasEdited(true);
  };

  const debouncedUsername = useDebounce(lichessUsername, 500);

  const {
    data: games,
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["LichessUserGames", debouncedUsername],
    enabled: !!debouncedUsername,
    queryFn: ({ signal }) =>
      getLichessUserRecentGames(debouncedUsername ?? "", signal),
    retry: 1,
  });

  return (
    <Stack spacing={2} width="100%">
      <FormControl fullWidth size="small">
        <Autocomplete
          freeSolo
          size="small"
          options={storedValues}
          inputValue={lichessUsername}
          onInputChange={handleChange}
          onChange={handleChange}
          renderOption={(props, option) => {
            const { key, ...rest } = props;
            return (
              <li
                key={key}
                {...rest}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingRight: 8,
                }}
              >
                <span>{option}</span>
                <IconButton
                  size="small"
                  aria-label={`Remove ${option}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteUsername(option);
                  }}
                >
                  <Icon icon="mdi:close" height={16} />
                </IconButton>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Lichess username"
              placeholder="Enter a Lichess username…"
              variant="outlined"
            />
          )}
        />
      </FormControl>

      {debouncedUsername && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 88,
            width: "100%",
          }}
        >
          {isFetching ? (
            <CircularProgress size={28} />
          ) : isError ? (
            <Alert severity="error" sx={{ width: "100%" }}>
              User not found. Please check the Lichess username.
            </Alert>
          ) : !games?.length ? (
            <Alert severity="info" sx={{ width: "100%" }}>
              No recent games found for &ldquo;{debouncedUsername}&rdquo;.
            </Alert>
          ) : (
            <List disablePadding sx={{ width: "100%" }}>
              {games.map((game) => {
                const perspectiveUserColor =
                  game.white.name.toLowerCase() ===
                  debouncedUsername.toLowerCase()
                    ? "white"
                    : "black";

                return (
                  <GameItem
                    key={game.id}
                    game={game}
                    perspectiveUserColor={perspectiveUserColor}
                    onClick={() => {
                      const boardOrientation =
                        debouncedUsername.toLowerCase() !==
                        game.black.name.toLowerCase();
                      onSelect(game.pgn, boardOrientation);
                      updateHistory(debouncedUsername);
                    }}
                  />
                );
              })}
            </List>
          )}
        </Box>
      )}
    </Stack>
  );
}
