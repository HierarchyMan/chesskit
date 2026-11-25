import { Box, Typography } from "@mui/material";

interface Props {
  title: string;
  whiteValue: string | number;
  blackValue: string | number;
}

export default function PlayersMetric({
  title,
  whiteValue,
  blackValue,
}: Props) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
        alignItems: "center",
        columnGap: 2,
        width: "100%",
      }}
    >
      <ValueBlock value={whiteValue} color="white" />

      <Typography
        align="center"
        variant="body2"
        color="text.secondary"
        fontWeight={500}
        noWrap
      >
        {title}
      </Typography>

      <ValueBlock value={blackValue} color="black" />
    </Box>
  );
}

const ValueBlock = ({
  value,
  color,
}: {
  value: string | number;
  color: "white" | "black";
}) => {
  return (
    <Typography
      align="center"
      sx={{
        bgcolor: color === "white" ? "#f4f5f7" : "#1e2026",
        color: color === "white" ? "#141519" : "#f4f5f7",
        justifySelf: "center",
        minWidth: 68,
        borderRadius: 1,
        border: 1,
        borderColor: "divider",
        px: 1.25,
        py: 0.55,
        fontSize: "0.875rem",
        fontWeight: 600,
        lineHeight: 1.2,
        fontVariantNumeric: "tabular-nums",
      }}
      noWrap
    >
      {value}
    </Typography>
  );
};
