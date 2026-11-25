import { Icon } from "@iconify/react";
import { Chip, Tooltip } from "@mui/material";

interface Props {
  date?: string;
}

export default function DateChip({ date }: Props) {
  if (!date) return null;

  return (
    <Tooltip title="Date played">
      <Chip
        variant="outlined"
        icon={<Icon icon="mdi:calendar-outline" height={15} />}
        label={date}
        size="small"
        sx={{ fontVariantNumeric: "tabular-nums" }}
      />
    </Tooltip>
  );
}
