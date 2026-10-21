import {
  EditablePosition,
  positionFromFen,
  positionToFen,
  sanitizePosition,
  validatePosition,
  parseFenLoose,
} from "@/lib/editorPosition";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { useLoadAnalysisGame } from "../hooks/useLoadAnalysisGame";
import {
  arrangeModeAtom,
  arrangeStartFenAtom,
  boardAtom,
  editablePositionAtom,
  arrangeFenDraftAtom,
} from "../states";

export const useArrangeMode = () => {
  const [arrange, setArrange] = useAtom(arrangeModeAtom);
  const board = useAtomValue(boardAtom);
  const [position, setPosition] = useAtom(editablePositionAtom);
  const [fenDraft, setFenDraft] = useAtom(arrangeFenDraftAtom);
  const [, setStartFen] = useAtom(arrangeStartFenAtom);
  const { loadFen } = useLoadAnalysisGame();

  const validation = useMemo(() => {
    const effective = fenDraft === null ? position : parseFenLoose(fenDraft);
    return effective
      ? validatePosition(sanitizePosition(effective))
      : {
          ok: false,
          problems: ["Enter a valid FEN before continuing."],
          warnings: [],
        };
  }, [position, fenDraft]);

  const enterArrange = useCallback(
    (fen?: string) => {
      const next = positionFromFen(fen ?? board.fen());
      setPosition(next);
      setFenDraft(null);
      setStartFen(fen ? null : positionToFen(next));
      setArrange(true);
    },
    [board, setPosition, setStartFen, setArrange, setFenDraft]
  );

  const finishArrange = useCallback(
    (override?: EditablePosition): boolean => {
      const effective =
        override ?? (fenDraft === null ? position : parseFenLoose(fenDraft));
      if (!effective) return false;
      const sanitized = sanitizePosition(effective);
      if (!validatePosition(sanitized).ok) return false;

      const fen = positionToFen(sanitized);
      // Explicit Analyze always loads this root, even after exploring away from it.
      loadFen(fen, true);

      setArrange(false);
      setFenDraft(null);
      return true;
    },
    [position, fenDraft, loadFen, setArrange, setFenDraft]
  );

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
