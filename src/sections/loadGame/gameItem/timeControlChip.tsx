import { Icon } from "@iconify/react";
import { Chip, Tooltip } from "@mui/material";

interface Props {
  timeControl?: string;
}

export default function TimeControlChip({ timeControl }: Props) {
  if (!timeControl) return null;

  return (
    <Tooltip title="Time control">
      <Chip
        variant="outlined"
        icon={<Icon icon="mdi:timer-outline" height={15} />}
        label={timeControl}
        size="small"
        sx={{ fontVariantNumeric: "tabular-nums" }}
      />
    </Tooltip>
  );
}
