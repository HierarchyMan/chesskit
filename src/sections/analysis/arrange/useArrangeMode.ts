import {
  EditablePosition,
  positionFromFen,
  positionToFen,
  sanitizePosition,
  validatePosition,
} from "@/lib/editorPosition";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { useLoadAnalysisGame } from "../hooks/useLoadAnalysisGame";
import {
  arrangeModeAtom,
  arrangeStartFenAtom,
  boardAtom,
  editablePositionAtom,
} from "../states";

export const useArrangeMode = () => {
  const [arrange, setArrange] = useAtom(arrangeModeAtom);
  const board = useAtomValue(boardAtom);
  const [position, setPosition] = useAtom(editablePositionAtom);
  const [startFen, setStartFen] = useAtom(arrangeStartFenAtom);
  const { loadFen } = useLoadAnalysisGame();

  const validation = useMemo(() => validatePosition(position), [position]);

  const enterArrange = useCallback(
    (fen?: string) => {
      const next = positionFromFen(fen ?? board.fen());
      setPosition(next);
      setStartFen(fen ? null : positionToFen(next));
      setArrange(true);
    },
    [board, setPosition, setStartFen, setArrange]
  );

  const finishArrange = useCallback((): boolean => {
    const sanitized = sanitizePosition(position);
    if (!validatePosition(sanitized).ok) return false;

    const fen = positionToFen(sanitized);
    if (fen !== startFen) loadFen(fen);

    setArrange(false);
    return true;
  }, [position, startFen, loadFen, setArrange]);

  const leaveArrange = useCallback(() => setArrange(false), [setArrange]);

  return { arrange, enterArrange, finishArrange, leaveArrange, validation };
};

export const useSetArrangePosition = () => {
  const setPosition = useSetAtom(editablePositionAtom);

  return useCallback(
    (update: (position: EditablePosition) => EditablePosition) =>
      setPosition((current) => sanitizePosition(update(current))),
    [setPosition]
  );
};
