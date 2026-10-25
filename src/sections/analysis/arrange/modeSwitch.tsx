import { Icon } from "@iconify/react";
import { Stack, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useArrangeMode } from "./useArrangeMode";
import { useRouter } from "next/router";

export default function ModeSwitch() {
  const { arrange, enterArrange, leaveArrange } = useArrangeMode();
  const router = useRouter();

  const handleChange = (_: unknown, value: "play" | "arrange" | null) => {
    if (!value) return;
    if (value === "arrange" && !arrange) enterArrange();
    if (value === "play" && arrange) {
      leaveArrange();
      if (router.pathname === "/editor")
        void router.replace("/analysis", undefined, { scroll: false });
    }
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="center"
      gap={1}
      width="100%"
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={arrange ? "arrange" : "play"}
        onChange={handleChange}
        aria-label="Board mode"
        fullWidth
        sx={{
          "& .MuiToggleButton-root": {
            borderRadius: 1,
            py: 0.6,
            minHeight: 34,
            textTransform: "none",
          },
        }}
      >
        <ToggleButton
          value="play"
          title={
            arrange
              ? "Return to the study without applying this arrangement"
              : undefined
          }
          sx={{ px: 2 }}
        >
          <Icon icon="mdi:chess-pawn" height={18} />
          &nbsp;Analyze
        </ToggleButton>
        <ToggleButton value="arrange" sx={{ px: 2 }}>
          <Icon icon="mdi:pencil-ruler" height={18} />
          &nbsp;Arrange pieces
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}
