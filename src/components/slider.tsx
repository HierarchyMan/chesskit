import { Icon } from "@iconify/react";
import {
  ClickAwayListener,
  Grid2 as Grid,
  IconButton,
  Slider as MuiSlider,
  Popover,
  Stack,
  styled,
  Typography,
  TypographyProps,
} from "@mui/material";
import { MouseEvent, useId, useState } from "react";

export interface Props {
  value: number;
  setValue: (value: number) => void;
  min: number;
  max: number;
  label: string;
  size?: number;
  marksFilter?: number;
  step?: number;
  infoContent?: TypographyProps["children"];
}

export default function Slider({
  min,
  max,
  label,
  value,
  setValue,
  size,
  marksFilter,
  step = 1,
  infoContent,
}: Props) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const popoverId = `${baseId}-popover`;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpenPopover = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
  };

  return (
    <Grid
      container
      justifyContent="center"
      alignItems="center"
      size={size ?? 12}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        width="100%"
        gap={1}
      >
        <Stack direction="row" alignItems="center" gap={0.5} minWidth={0}>
          <Typography id={labelId} variant="body2" fontWeight={500}>
            {label}
          </Typography>

          {!!infoContent && (
            <>
              <ClickAwayListener onClickAway={handleClosePopover}>
                <IconButton
                  size="small"
                  aria-owns={anchorEl ? popoverId : undefined}
                  aria-haspopup="true"
                  onClick={handleOpenPopover}
                  onMouseEnter={handleOpenPopover}
                  onMouseLeave={handleClosePopover}
                  sx={{ p: 0.25, color: "text.secondary" }}
                  aria-label={`Help about ${label}`}
                >
                  <Icon icon="mdi:info-outline" width="1rem" />
                </IconButton>
              </ClickAwayListener>

              <Popover
                id={popoverId}
                open={!!anchorEl}
                anchorEl={anchorEl}
                onClose={handleClosePopover}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                transformOrigin={{ vertical: "top", horizontal: "center" }}
                sx={{ pointerEvents: "none" }}
                disableRestoreFocus
              >
                <Typography variant="body2" sx={{ padding: 2, maxWidth: 420 }}>
                  {infoContent}
                </Typography>
              </Popover>
            </>
          )}
        </Stack>

        <Typography
          component="span"
          variant="caption"
          sx={{
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            px: 0.75,
            py: 0.15,
            borderRadius: 1,
            bgcolor: "action.hover",
            color: "text.primary",
            flexShrink: 0,
          }}
        >
          {value}
        </Typography>
      </Stack>

      <CustomSlider
        min={min}
        max={max}
        marks={
          marksFilter
            ? Array.from({ length: max - min + 1 }, (_, i) => ({
                value: i + min,
                label: `${i + min}`,
              })).filter((_, i) => i % marksFilter === 0)
            : undefined
        }
        step={step}
        valueLabelDisplay="off"
        value={value}
        onChange={(_, nextValue) => setValue(nextValue as number)}
        aria-labelledby={labelId}
      />
    </Grid>
  );
}

const CustomSlider = styled(MuiSlider)(() => ({
  ".MuiSlider-markLabel": {
    fontSize: "0.75rem",
    lineHeight: "0.8rem",
    fontVariantNumeric: "tabular-nums",
  },
  ".MuiSlider-thumb": {
    width: "16px",
    height: "16px",
  },
  marginBottom: "1rem",
}));
