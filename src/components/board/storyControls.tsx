import { Box } from "@mui/material";
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
    <Box sx={{ width: "100%" }}>
      <CascadeBar
        cascade={projection}
        onTogglePlay={story.togglePlay}
        onPrev={story.stepPrev}
        onNext={story.stepNext}
        onReplay={story.replay}
        onSwitchBranch={story.switchBranch}
        onExit={story.stop}
        showCaption
      />
    </Box>
  );
}
