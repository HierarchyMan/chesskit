import { statusColor } from "@/components/modelMenuLabel";
import { useModels } from "@/hooks/useModels";
import { ModelView, describeModel } from "@/lib/engine/modelStatus";
import { EngineGroup, EngineModel, engineLabel } from "@/lib/engine/models";
import { EngineId } from "@/types/enums";
import { Icon } from "@iconify/react";
import {
  Box,
  ButtonBase,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListSubheader,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

// "feature": engines whose evaluations are real, for features that grade moves.
export type EngineRole = "analysis" | "play" | "feature";
export type EnginePick = EngineId | "analysis";

const GROUPS: { id: EngineGroup; title: string; blurb: string }[] = [
  {
    id: "native",
    title: "On this computer",
    blurb: "Native programs through the local bridge: the strongest option.",
  },
  {
    id: "stockfish",
    title: "Stockfish",
    blurb: "Every Stockfish build, in the browser.",
  },
  {
    id: "other",
    title: "Other engines",
    blurb: "Different authors, different styles, all in the browser.",
  },
  {
    id: "joke",
    title: "Joke engines",
    blurb: "For fun. They play, but their opinions are not to be trusted.",
  },
];

type Filter = "all" | "strong" | "light" | "nowasm" | "joke";

const FILTERS: {
  id: Filter;
  label: string;
  test: (model: EngineModel) => boolean;
}[] = [
  { id: "all", label: "All", test: () => true },
  {
    id: "strong",
    label: "3500+",
    test: (model) => (model.rating?.elo ?? 0) >= 3500,
  },
  {
    id: "light",
    label: "Under 10 MB",
    test: (model) =>
      model.source !== "builtin" &&
      model.source !== "bridge" &&
      model.sizeMb < 10,
  },
  {
    id: "nowasm",
    label: "No WebAssembly",
    test: (model) => model.source === "browser" && !model.needsWasm,
  },
  { id: "joke", label: "Jokes", test: (model) => model.group === "joke" },
];

const ratingText = (model: EngineModel): string | undefined =>
  model.rating ? `${model.rating.elo}` : undefined;

const ratingSource = (model: EngineModel): string =>
  model.rating?.source === "ccrl"
    ? "CCRL Blitz rating, native build"
    : "Author's estimate";

function RatingBadge({ model }: { model: EngineModel }) {
  const text = ratingText(model);
  if (!text) return null;
  return (
    <Tooltip title={ratingSource(model)}>
      <Box
        sx={{
          px: 1,
          py: 0.25,
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          textAlign: "center",
          minWidth: 52,
          flexShrink: 0,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
          {text}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.7, lineHeight: 1 }}>
          {model.rating?.source === "ccrl" ? "CCRL" : "est."}
        </Typography>
      </Box>
    </Tooltip>
  );
}

function EngineRow({
  view,
  role,
  selected,
  onSelect,
  onDownload,
}: {
  view: ModelView;
  role: EngineRole;
  selected: boolean;
  onSelect: () => void;
  onDownload: () => void;
}) {
  const { model } = view;
  const status = describeModel(view);
  const canDownload =
    model.source === "browser" &&
    view.supported &&
    !view.downloaded &&
    !view.progress;

  return (
    <ListItemButton
      selected={selected}
      disabled={!view.supported}
      onClick={onSelect}
      sx={{
        alignItems: "flex-start",
        gap: 1.5,
        py: 1.25,
        borderRadius: 1,
        mx: 1,
      }}
    >
      <Box
        sx={{ pt: 0.25, color: selected ? "primary.main" : "text.secondary" }}
      >
        <Icon
          icon={selected ? "mdi:check-circle" : "mdi:circle-outline"}
          height={20}
        />
      </Box>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {model.label.full}
          </Typography>
          {model.tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 11 }}
            />
          ))}
          {model.roles.analysis &&
            !model.reliableEval &&
            role === "analysis" && (
              <Chip
                label="Evaluation not real"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ height: 20, fontSize: 11 }}
              />
            )}
          {!model.roles.analysis && (
            <Chip
              label="Play only"
              size="small"
              color="warning"
              variant="outlined"
              sx={{ height: 20, fontSize: 11 }}
            />
          )}
        </Stack>
        {model.description && (
          <Typography
            variant="body2"
            sx={{
              opacity: 0.75,
              mt: 0.25,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {model.description}
          </Typography>
        )}
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.25,
            color: statusColor(status.tone),
            opacity: status.tone === "default" ? 0.75 : 1,
          }}
        >
          {status.text}
        </Typography>
      </Box>
      <Stack alignItems="flex-end" gap={0.5}>
        <RatingBadge model={model} />
        {canDownload && (
          <Tooltip
            title={`Keep a copy for offline use (about ${model.sizeMb} MB)`}
          >
            <IconButton
              size="small"
              aria-label={`Download ${model.label.full}`}
              onClick={(event) => {
                event.stopPropagation();
                onDownload();
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <Icon icon="mdi:download" height={18} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </ListItemButton>
  );
}

interface PickerProps {
  open: boolean;
  onClose: () => void;
  value: EnginePick;
  onSelect: (value: EnginePick) => void;
  role: EngineRole;
  title: string;
  // Offers "Same as the analysis engine", showing which engine that is.
  inherit?: EngineId;
  footer?: ReactNode;
}

const matches = (model: EngineModel, query: string): boolean => {
  if (!query) return true;
  const text = [
    model.label.full,
    model.family,
    model.description,
    ...model.tags,
  ]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => text.includes(word));
};

const byRating = (a: ModelView, b: ModelView) =>
  (b.model.rating?.elo ?? -1) - (a.model.rating?.elo ?? -1);

/** Mounted only while the dialog is open, so every opening starts with a clean search. */
function PickerContent({
  onClose,
  value,
  onSelect,
  role,
  title,
  inherit,
  footer,
  fullScreen,
}: Omit<PickerProps, "open"> & { fullScreen: boolean }) {
  const { models, refresh, download, bridge } = useModels();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    void refresh();
    // Opening the picker shows the current engine, wherever it is in the list.
    const frame = requestAnimationFrame(() =>
      listRef.current
        ?.querySelector(".Mui-selected")
        ?.scrollIntoView({ block: "center" })
    );
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  const filters = FILTERS.filter(
    (entry) => role !== "feature" || entry.id !== "joke"
  );

  const groups = useMemo(() => {
    const test =
      FILTERS.find((entry) => entry.id === filter)?.test ?? (() => true);
    return GROUPS.map((group) => ({
      ...group,
      views: models
        .filter(
          (view) =>
            view.model.group === group.id &&
            (role === "feature"
              ? view.model.roles.analysis && view.model.reliableEval
              : view.model.roles[role]) &&
            test(view.model) &&
            matches(view.model, query.trim())
        )
        .sort(byRating),
    })).filter((group) => group.views.length > 0);
  }, [models, role, filter, query]);

  const choose = (pick: EnginePick) => {
    onSelect(pick);
    onClose();
  };

  return (
    <>
      <DialogTitle
        sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1 }}
      >
        <Icon icon="mdi:chip" height={22} />
        <Box sx={{ flexGrow: 1 }}>{title}</Box>
        <IconButton onClick={onClose} aria-label="Close" edge="end">
          <Icon icon="mdi:close" height={20} />
        </IconButton>
      </DialogTitle>
      <Box sx={{ px: 3, pb: 1.5 }}>
        <TextField
          fullWidth
          size="small"
          autoFocus={!fullScreen}
          placeholder="Search engines: stockfish, nnue, joke, javascript…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Icon icon="mdi:magnify" height={20} />
                </InputAdornment>
              ),
            },
          }}
        />
        <Stack direction="row" gap={0.75} mt={1.25} flexWrap="wrap">
          {filters.map((entry) => (
            <Chip
              key={entry.id}
              label={entry.label}
              size="small"
              color={filter === entry.id ? "primary" : "default"}
              variant={filter === entry.id ? "filled" : "outlined"}
              onClick={() => setFilter(entry.id)}
            />
          ))}
        </Stack>
      </Box>
      <DialogContent dividers sx={{ px: 0, py: 0 }}>
        <List disablePadding ref={listRef}>
          {inherit && (
            <ListItemButton
              selected={value === "analysis"}
              onClick={() => choose("analysis")}
              sx={{ gap: 1.5, py: 1.25, borderRadius: 1, mx: 1, my: 1 }}
            >
              <Box
                sx={{
                  color:
                    value === "analysis" ? "primary.main" : "text.secondary",
                }}
              >
                <Icon
                  icon={
                    value === "analysis"
                      ? "mdi:check-circle"
                      : "mdi:circle-outline"
                  }
                  height={20}
                />
              </Box>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  Same as the analysis engine
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  Now {engineLabel(inherit).full}. Follows it when you change
                  it.
                </Typography>
              </Box>
            </ListItemButton>
          )}
          {groups.map((group) => (
            <li key={group.id}>
              <ul style={{ padding: 0 }}>
                <ListSubheader
                  sx={{ lineHeight: 1.4, py: 1, bgcolor: "background.paper" }}
                >
                  <Typography
                    variant="overline"
                    sx={{ display: "block", lineHeight: 1.6 }}
                  >
                    {group.title}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    {group.blurb}
                    {group.id === "native" &&
                      bridge === "down" &&
                      " The bridge is not running: start start-reckless-bridge.bat."}
                  </Typography>
                </ListSubheader>
                {group.views.map((view) => (
                  <EngineRow
                    key={view.model.name}
                    view={view}
                    role={role}
                    selected={value === view.model.name}
                    onSelect={() => choose(view.model.name)}
                    onDownload={() => void download(view.model.name)}
                  />
                ))}
              </ul>
            </li>
          ))}
          {!groups.length && (
            <Typography sx={{ p: 3, opacity: 0.75 }} variant="body2">
              No engine matches. Clear the search or pick another filter.
            </Typography>
          )}
        </List>
      </DialogContent>
      {footer && <Box sx={{ px: 3, py: 1.5 }}>{footer}</Box>}
    </>
  );
}

export function EnginePickerDialog({ open, onClose, ...content }: PickerProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: { sx: { height: fullScreen ? "100%" : "min(760px, 90vh)" } },
      }}
    >
      <PickerContent {...content} onClose={onClose} fullScreen={fullScreen} />
    </Dialog>
  );
}

/** A form field showing the chosen engine; opens the picker. */
export function EngineField({
  label,
  value,
  onChange,
  role,
  inherit,
  helper,
}: {
  label: string;
  value: EnginePick;
  onChange: (value: EnginePick) => void;
  role: EngineRole;
  inherit?: EngineId;
  helper?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { models } = useModels();
  const engine = value === "analysis" ? inherit : value;
  const view = models.find((entry) => entry.model.name === engine);
  const status = view ? describeModel(view) : undefined;

  return (
    <Box>
      <ButtonBase
        onClick={() => setOpen(true)}
        aria-label={`${label}: ${engine ? engineLabel(engine).full : "none"}. Change`}
        sx={{
          width: "100%",
          textAlign: "left",
          justifyContent: "flex-start",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          px: 1.75,
          py: 1,
          gap: 1.5,
          "&:hover": { borderColor: "text.primary" },
          "&.Mui-focusVisible": { borderColor: "primary.main" },
        }}
      >
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.7, display: "block" }}>
            {label}
          </Typography>
          <Typography variant="body1" noWrap>
            {value === "analysis" && inherit
              ? `Same as analysis (${engineLabel(inherit).small})`
              : engine
                ? engineLabel(engine).full
                : "Choose an engine"}
          </Typography>
          {status && (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: statusColor(status.tone),
                opacity: status.tone === "default" ? 0.75 : 1,
              }}
            >
              {status.text}
            </Typography>
          )}
        </Box>
        {view && <RatingBadge model={view.model} />}
        <Icon icon="mdi:chevron-right" height={22} />
      </ButtonBase>
      {helper && (
        <Typography
          variant="caption"
          sx={{ opacity: 0.7, mt: 0.5, display: "block" }}
        >
          {helper}
        </Typography>
      )}
      <EnginePickerDialog
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        onSelect={onChange}
        role={role}
        title={label}
        inherit={inherit}
      />
    </Box>
  );
}
