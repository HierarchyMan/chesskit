import { Box, Typography } from "@mui/material";
import { useInBoardCascade } from "@/lib/coachCascade";
import CascadeBar from "./cascadeBar";

export default function StoryControls({
  story,
}: {
  story: ReturnType<typeof useInBoardCascade>;
}) {
  const { projection } = story;
  if (!projection.active) return null;

  return (
    <Box>
      <CascadeBar
        cascade={projection}
        onTogglePlay={story.togglePlay}
        onPrev={story.stepPrev}
        onNext={story.stepNext}
        onReplay={story.replay}
        onSwitchBranch={story.switchBranch}
        onExit={story.stop}
      />
      <Typography
        component="div"
        variant="body2"
        aria-live="polite"
        sx={{
          height: 60,
          overflowY: "auto",
          overflowWrap: "anywhere",
          px: 1,
          py: 0.5,
        }}
      >
        {projection.san && <strong>{projection.san}: </strong>}
        {projection.caption}
      </Typography>
    </Box>
  );
}
