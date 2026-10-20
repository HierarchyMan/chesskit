import { Handoff, HANDOFF_EVENT, takeHandoff } from "@/lib/handoff";
import { useEffect, useRef } from "react";

export const useHandoff = <K extends Handoff["kind"]>(
  kinds: K[],
  onHandoff: (handoff: Extract<Handoff, { kind: K }>) => void
) => {
  const onHandoffRef = useRef(onHandoff);

  useEffect(() => {
    onHandoffRef.current = onHandoff;
  });

  const kindList = kinds.join("|");

  useEffect(() => {
    const accepted = kindList.split("|") as K[];

    const consume = () => {
      const handoff = takeHandoff(...accepted);
      if (handoff) onHandoffRef.current(handoff);
    };

    consume();
    window.addEventListener(HANDOFF_EVENT, consume);

    return () => {
      window.removeEventListener(HANDOFF_EVENT, consume);
    };
  }, [kindList]);
};
