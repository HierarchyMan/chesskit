import { Icon } from "@iconify/react";
import {
  Box,
  FormControlLabel,
  IconButton,
  Popover,
  PopoverProps,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { ReactNode } from "react";

interface InspectorPopoverProps
  extends Omit<PopoverProps, "children" | "title"> {
  title?: string;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}

/** Shared popover surface for Options & Overlays across Play, Arena, Analysis, Puzzles, Vision. */
export function InspectorPopover({
  title,
  onClose,
  width = 316,
  anchorOrigin = { vertical: "top", horizontal: "left" },
  transformOrigin = { vertical: "bottom", horizontal: "left" },
  children,
  ...rest
}: InspectorPopoverProps) {
  return (
    <Popover
      onClose={onClose}
      marginThreshold={12}
      anchorOrigin={anchorOrigin}
      transformOrigin={transformOrigin}
      slotProps={{
        paper: {
          sx: {
            width: `min(${width}px, calc(100vw - 32px))`,
            maxHeight: "min(72dvh, 540px)",
            borderRadius: 1.5,
            border: 1,
            borderColor: "divider",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            my: 0.75,
          },
        },
      }}
      {...rest}
    >
      {title && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 1.5,
            py: 1,
            flexShrink: 0,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle2" fontWeight={700}>
            {title}
          </Typography>
          <IconButton
            size="small"
            aria-label={`Close ${title.toLowerCase()}`}
            onClick={onClose}
            sx={{ p: 0.35 }}
          >
            <Icon icon="mdi:close" height={17} />
          </IconButton>
        </Stack>
      )}
      <Box
        sx={{
          px: 1.5,
          py: 1.25,
          overflowY: "auto",
          minHeight: 0,
        }}
      >
        {children}
      </Box>
    </Popover>
  );
}

/** Standardized compact switch row inside InspectorPopover. */
export function PopoverSwitchRow({
  label,
  help,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Box>
      <FormControlLabel
        labelPlacement="start"
        label={<Typography variant="body2">{label}</Typography>}
        control={
          <Switch
            size="small"
            checked={checked}
            disabled={disabled}
            onChange={(_, next) => onChange(next)}
          />
        }
        sx={{
          m: 0,
          width: "100%",
          minHeight: 34,
          justifyContent: "space-between",
          gap: 2,
        }}
      />
      {help && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mt: -0.25, mb: 0.5, lineHeight: 1.3 }}
        >
          {help}
        </Typography>
      )}
    </Box>
  );
}

/** Uppercase section label inside popovers and menus. */
export function PopoverSectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="caption"
      fontWeight={700}
      color="text.secondary"
      sx={{
        display: "block",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontSize: "0.68rem",
      }}
    >
      {children}
    </Typography>
  );
}
