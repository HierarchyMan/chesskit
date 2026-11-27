import {
  Alert,
  Box,
  Button,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";
import {
  DataGrid,
  GridActionsCellItem,
  GridColDef,
  GridLocaleText,
  GridRowId,
  GRID_DEFAULT_LOCALE_TEXT,
} from "@mui/x-data-grid";
import { useCallback, useMemo, useState } from "react";
import LoadGameButton from "@/sections/loadGame/loadGameButton";
import { useGameSummaries } from "@/hooks/useGameDatabase";
import { GameSummary } from "@/lib/gameDatabase";
import { useRouter } from "next/router";
import NextLink from "next/link";
import { PageTitle } from "@/components/pageTitle";
import { copyToClipboard } from "@/lib/clipboard";
import Panel from "@/components/panel";

const gridLocaleText: GridLocaleText = {
  ...GRID_DEFAULT_LOCALE_TEXT,
  noRowsLabel: "No matching games",
};

const formatPlayer = (name?: string, rating?: number): string => {
  const label = name?.trim() || "Unknown";
  return rating ? `${label} (${rating})` : label;
};

const formatTimeControl = (tc?: string): string => {
  if (!tc || tc === "-" || tc === "?") return "—";
  const match = tc.match(/^(\d+)(?:\+(\d+))?$/);
  if (!match) return tc;
  const baseSec = Number(match[1]);
  const inc = match[2] ? Number(match[2]) : 0;
  if (baseSec >= 60 && baseSec % 60 === 0) {
    return `${baseSec / 60}+${inc}`;
  }
  return inc ? `${baseSec}s+${inc}` : `${baseSec}s`;
};

const formatResult = (result?: string): string => {
  if (!result) return "—";
  if (result === "1/2-1/2") return "½–½";
  return result;
};

export default function GameDatabase() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const { games, deleteGame, getGame } = useGameSummaries();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "analyzed">("all");
  const [pendingDelete, setPendingDelete] = useState<GameSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const analyzedCount = useMemo(
    () => games.filter((game) => game.hasEvaluation).length,
    [games]
  );

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    return games.filter((game) => {
      if (filter === "analyzed" && !game.hasEvaluation) return false;
      if (!query) return true;
      const fields = [
        game.white?.name,
        game.black?.name,
        game.event,
        game.site,
        game.date,
        game.result,
        game.timeControl,
      ];
      return fields.some((field) => field?.toLowerCase().includes(query));
    });
  }, [games, search, filter]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteGame(pendingDelete.id);
      setToast({ message: "Game deleted", severity: "success" });
    } catch (error) {
      console.error(error);
      setToast({
        message: "Could not delete game. Please try again.",
        severity: "error",
      });
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }, [deleteGame, pendingDelete]);

  const handleCopyGameRow = useCallback(
    (id: GridRowId) => async () => {
      try {
        if (typeof id !== "number") throw new Error("Invalid game id");
        const game = await getGame(id);
        if (!game) throw new Error("Game not found");
        const ok = await copyToClipboard(game.pgn);
        if (!ok) throw new Error("Clipboard unavailable");
        setToast({ message: "PGN copied", severity: "success" });
      } catch (error) {
        console.error(error);
        setToast({
          message: "Could not copy PGN to clipboard.",
          severity: "error",
        });
      }
    },
    [getGame]
  );

  const columns: GridColDef<GameSummary>[] = useMemo(
    () => [
      {
        field: "players",
        headerName: "White vs Black",
        flex: 2,
        minWidth: 210,
        valueGetter: (_, row) =>
          `${row.white?.name ?? "Unknown"} ${row.black?.name ?? "Unknown"}`,
        renderCell: ({ row }) => (
          <Stack
            spacing={0.25}
            justifyContent="center"
            sx={{ height: "100%", minWidth: 0, py: 0.5 }}
          >
            <Stack direction="row" alignItems="center" gap={0.75} minWidth={0}>
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  bgcolor: "#f2f2f2",
                  border: "1px solid",
                  borderColor: "divider",
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="body2"
                fontWeight={600}
                noWrap
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatPlayer(row.white?.name, row.white?.rating)}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" gap={0.75} minWidth={0}>
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  bgcolor: "#1d1d1d",
                  border: "1px solid",
                  borderColor: "divider",
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatPlayer(row.black?.name, row.black?.rating)}
              </Typography>
            </Stack>
          </Stack>
        ),
      },
      {
        field: "result",
        headerName: "Result",
        width: 90,
        headerAlign: "center",
        align: "center",
        renderCell: ({ value }) => (
          <Chip
            size="small"
            variant="outlined"
            label={formatResult(value as string | undefined)}
            sx={{
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              minWidth: 54,
            }}
          />
        ),
      },
      {
        field: "date",
        headerName: "Event / Date",
        flex: 1.4,
        minWidth: 160,
        renderCell: ({ row }) => (
          <Stack
            spacing={0.25}
            justifyContent="center"
            sx={{ height: "100%", minWidth: 0, py: 0.5 }}
          >
            <Typography variant="body2" noWrap>
              {row.event && row.event !== "?"
                ? row.event
                : row.site || "Casual game"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              {row.date && row.date !== "????.??.??" ? row.date : "—"}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "timeControl",
        headerName: "Time",
        width: 96,
        headerAlign: "center",
        align: "center",
        valueFormatter: (value) =>
          formatTimeControl(value as string | undefined),
        renderCell: ({ value }) => (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatTimeControl(value as string | undefined)}
          </Typography>
        ),
      },
      {
        field: "hasEvaluation",
        headerName: "Status",
        width: 112,
        headerAlign: "center",
        align: "center",
        renderCell: ({ value }) =>
          value ? (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              icon={<Icon icon="mdi:check-circle" height={14} />}
              label="Analyzed"
            />
          ) : (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          ),
      },
      {
        field: "actions",
        type: "actions",
        headerName: "Actions",
        width: 116,
        getActions: ({ id, row }) => [
          <GridActionsCellItem
            key={`${id}-analyze`}
            icon={
              <Tooltip title="Analyze game">
                <span>
                  <Icon icon="mdi:chart-line" width={20} />
                </span>
              </Tooltip>
            }
            label="Analyze"
            onClick={() =>
              void router.push({ pathname: "/analysis", query: { gameId: id } })
            }
            color="inherit"
          />,
          <GridActionsCellItem
            key={`${id}-copy`}
            icon={
              <Tooltip title="Copy PGN">
                <span>
                  <Icon icon="mdi:content-copy" width={19} />
                </span>
              </Tooltip>
            }
            label="Copy PGN"
            onClick={handleCopyGameRow(id)}
            color="inherit"
          />,
          <GridActionsCellItem
            key={`${id}-delete`}
            icon={
              <Tooltip title="Delete game">
                <span>
                  <Icon icon="mdi:delete-outline" width={20} />
                </span>
              </Tooltip>
            }
            label="Delete"
            onClick={() => setPendingDelete(row)}
            sx={{
              color: "text.secondary",
              "&:hover": { color: "error.main" },
            }}
          />,
        ],
      },
    ],
    [handleCopyGameRow, router]
  );

  return (
    <Stack
      spacing={2.5}
      sx={{ maxWidth: 1180, mx: "auto", py: 1, width: "100%" }}
    >
      <PageTitle title="Chesskit Game Database" />

      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        gap={1.5}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Game Database
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {games.length} saved game{games.length === 1 ? "" : "s"} ·{" "}
            {analyzedCount} analyzed
          </Typography>
        </Box>

        <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
          <LoadGameButton />
          <Button
            variant="outlined"
            size="small"
            startIcon={<Icon icon="mdi:chart-line" height={18} />}
            onClick={() => void router.push("/analysis")}
          >
            Open analysis
          </Button>
        </Stack>
      </Stack>

      {games.length === 0 ? (
        <Panel sx={{ borderRadius: 1.5, py: 5, textAlign: "center" }}>
          <Stack spacing={1.5} alignItems="center" maxWidth={440} mx="auto">
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 1.5,
                bgcolor: "action.hover",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "primary.main",
              }}
            >
              <Icon icon="mdi:database-outline" height={28} />
            </Box>
            <Typography variant="h6" fontWeight={600}>
              No saved games yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Import games from Chess.com, Lichess, or a PGN file, or play a
              game against a bot to start building your library.
            </Typography>
            <Stack
              direction="row"
              gap={1.5}
              flexWrap="wrap"
              justifyContent="center"
              pt={0.5}
            >
              <LoadGameButton />
              <Button
                component={NextLink}
                href="/play"
                variant="outlined"
                size="small"
                startIcon={<Icon icon="mdi:chess-pawn" height={18} />}
              >
                Play a game
              </Button>
            </Stack>
          </Stack>
        </Panel>
      ) : (
        <>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            gap={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <TextField
              size="small"
              placeholder="Search players, event, or date…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ minWidth: { sm: 280 }, maxWidth: { sm: 380 }, flex: 1 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon icon="mdi:magnify" height={18} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Stack direction="row" gap={1} alignItems="center">
              <Chip
                label={`All (${games.length})`}
                color={filter === "all" ? "primary" : "default"}
                variant={filter === "all" ? "filled" : "outlined"}
                onClick={() => setFilter("all")}
                sx={{ fontVariantNumeric: "tabular-nums" }}
              />
              <Chip
                label={`Analyzed (${analyzedCount})`}
                color={filter === "analyzed" ? "primary" : "default"}
                variant={filter === "analyzed" ? "filled" : "outlined"}
                onClick={() => setFilter("analyzed")}
                sx={{ fontVariantNumeric: "tabular-nums" }}
              />
            </Stack>
          </Stack>

          {isSmall ? (
            <Panel sx={{ borderRadius: 1.5, p: 0 }}>
              {filteredGames.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 3, textAlign: "center" }}
                >
                  No matching games
                </Typography>
              ) : (
                <Stack
                  divider={
                    <Box sx={{ borderTop: 1, borderColor: "divider" }} />
                  }
                >
                  {filteredGames.map((row) => {
                    const tc = formatTimeControl(row.timeControl);
                    const eventLabel =
                      row.event && row.event !== "?"
                        ? row.event
                        : row.site || "Casual game";
                    const meta = [
                      eventLabel,
                      row.date && row.date !== "????.??.??"
                        ? row.date
                        : undefined,
                      tc !== "—" ? tc : undefined,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <Stack
                        key={row.id}
                        direction="row"
                        alignItems="center"
                        sx={{ pr: 0.75 }}
                      >
                        <CardActionArea
                          onClick={() =>
                            void router.push({
                              pathname: "/analysis",
                              query: { gameId: row.id },
                            })
                          }
                          sx={{ p: 1.25, flex: 1, minWidth: 0 }}
                        >
                          <Stack spacing={0.5} minWidth={0}>
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                              gap={1}
                            >
                              <Stack spacing={0.2} minWidth={0} flex={1}>
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  gap={0.65}
                                  minWidth={0}
                                >
                                  <Box
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      bgcolor: "#f2f2f2",
                                      border: "1px solid",
                                      borderColor: "divider",
                                      flexShrink: 0,
                                    }}
                                  />
                                  <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    noWrap
                                    sx={{ fontVariantNumeric: "tabular-nums" }}
                                  >
                                    {formatPlayer(
                                      row.white?.name,
                                      row.white?.rating
                                    )}
                                  </Typography>
                                </Stack>
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  gap={0.65}
                                  minWidth={0}
                                >
                                  <Box
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      bgcolor: "#1d1d1d",
                                      border: "1px solid",
                                      borderColor: "divider",
                                      flexShrink: 0,
                                    }}
                                  />
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    noWrap
                                    sx={{ fontVariantNumeric: "tabular-nums" }}
                                  >
                                    {formatPlayer(
                                      row.black?.name,
                                      row.black?.rating
                                    )}
                                  </Typography>
                                </Stack>
                              </Stack>

                              <Stack
                                direction="row"
                                alignItems="center"
                                gap={0.5}
                                flexShrink={0}
                              >
                                {row.hasEvaluation && (
                                  <Icon
                                    icon="mdi:check-circle"
                                    height={16}
                                    style={{ color: "#2e7d32" }}
                                  />
                                )}
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={formatResult(row.result)}
                                  sx={{
                                    height: 22,
                                    minWidth: 46,
                                    fontWeight: 700,
                                    fontSize: "0.74rem",
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                />
                              </Stack>
                            </Stack>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              sx={{ fontVariantNumeric: "tabular-nums" }}
                            >
                              {meta}
                            </Typography>
                          </Stack>
                        </CardActionArea>

                        <Stack direction="row" gap={0.25} flexShrink={0}>
                          <IconButton
                            size="small"
                            aria-label="Copy PGN"
                            onClick={handleCopyGameRow(row.id)}
                          >
                            <Icon icon="mdi:content-copy" height={18} />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label="Delete game"
                            onClick={() => setPendingDelete(row)}
                            sx={{
                              color: "text.secondary",
                              "&:hover": { color: "error.main" },
                            }}
                          >
                            <Icon icon="mdi:delete-outline" height={19} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </Panel>
          ) : (
            <Box
              sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <DataGrid
                aria-label="Games list"
                rows={filteredGames}
                columns={columns}
                rowHeight={56}
                disableColumnMenu
                disableRowSelectionOnClick
                pageSizeOptions={[25, 50, 100]}
                localeText={gridLocaleText}
                onRowClick={(params) =>
                  void router.push({
                    pathname: "/analysis",
                    query: { gameId: params.id },
                  })
                }
                initialState={{
                  pagination: { paginationModel: { pageSize: 25, page: 0 } },
                  sorting: {
                    sortModel: [{ field: "date", sort: "desc" }],
                  },
                }}
                sx={{
                  borderRadius: 1.5,
                  bgcolor: "background.paper",
                  "& .MuiDataGrid-row": { cursor: "pointer" },
                }}
              />
            </Box>
          )}
        </>
      )}

      <Dialog
        open={!!pendingDelete}
        onClose={() => !deleting && setPendingDelete(null)}
      >
        <DialogTitle>Delete saved game?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingDelete
              ? `Remove ${formatPlayer(pendingDelete.white?.name)} vs ${formatPlayer(pendingDelete.black?.name)} and its stored analysis from your database? This cannot be undone.`
              : ""}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setPendingDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleting}
            onClick={() => void confirmDelete()}
          >
            Delete game
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={2600}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Stack>
  );
}
