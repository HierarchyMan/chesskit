import { Icon } from "@iconify/react";
import { Chip, Tooltip } from "@mui/material";

interface Props {
  movesNb?: number;
}

export default function MovesNbChip({ movesNb }: Props) {
  if (!movesNb) return null;

  return (
    <Tooltip title="Number of moves">
      <Chip
        variant="outlined"
        icon={<Icon icon="mdi:pound" height={15} />}
        label={`${Math.ceil(movesNb / 2)} moves`}
        size="small"
        sx={{ fontVariantNumeric: "tabular-nums" }}
      />
    </Tooltip>
  );
}
