import { detectInputAsync } from "@/lib/processing";
import { Icon } from "@iconify/react";
import { Alert, Box, Button, Snackbar, Typography } from "@mui/material";
import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { importDialogAtom } from "../layout/states";

const isTextField = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA");

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const hasFiles = (event: DragEvent): boolean =>
  !!event.dataTransfer &&
  Array.from(event.dataTransfer.types).includes("Files");

const SUPPORTED_TEXT_EXT = /\.(pgn|txt|fen)$/i;

const isSupportedTextFile = (file: File): boolean =>
  file.type.startsWith("text/") ||
  file.type === "application/x-chess-pgn" ||
  file.type === "application/vnd.chess-pgn" ||
  SUPPORTED_TEXT_EXT.test(file.name);

interface ToastState {
  message: string;
  severity: "info" | "warning";
  pasteText?: string;
}

export default function GlobalImportListeners() {
  const setDialog = useSetAtom(importDialogAtom);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let dragDepth = 0;
    let controller: AbortController | undefined;
    const beginInput = () => {
      controller?.abort();
      controller = new AbortController();
      return controller;
    };

    const clearDrag = () => {
      dragDepth = 0;
      setDragging(false);
    };

    const onPaste = async (event: ClipboardEvent) => {
      if (isTextField(event.target) || !event.clipboardData) return;

      const request = beginInput();
      const imageFile = Array.from(event.clipboardData.files).find((file) =>
        file.type.startsWith("image/")
      );
      if (imageFile) {
        event.preventDefault();
        const image = await readAsDataUrl(imageFile);
        if (!request.signal.aborted)
          setDialog({ open: true, initialImage: image });
        return;
      }

      const text = event.clipboardData.getData("text/plain");
      if (!text.trim()) return;

      try {
        const result = await detectInputAsync(text, request.signal);
        if (request.signal.aborted) return;
        if (result.kind !== "unknown") {
          setDialog({ open: true, initialText: text });
        } else {
          setToast({
            severity: "info",
            message:
              "Pasted text was not recognized as a PGN, FEN, or Lichess link.",
            pasteText: text,
          });
        }
      } catch (error) {
        if (!request.signal.aborted) console.error(error);
      }
    };

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      dragDepth++;
      setDragging(true);
    };

    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setDragging(false);
    };

    const onDragOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };

    // Always clear the backdrop in capture phase so page-level capture handlers
    // (such as /scan) calling stopPropagation() can never freeze the overlay.
    const onDropCapture = () => {
      clearDrag();
    };

    const onDrop = async (event: DragEvent) => {
      clearDrag();
      if (event.defaultPrevented) return;

      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      event.preventDefault();

      const request = beginInput();
      if (file.type.startsWith("image/")) {
        const image = await readAsDataUrl(file);
        if (!request.signal.aborted)
          setDialog({ open: true, initialImage: image });
      } else if (isSupportedTextFile(file)) {
        const text = await file.text();
        if (!request.signal.aborted)
          setDialog({ open: true, initialText: text });
      } else {
        setToast({
          severity: "warning",
          message:
            "Unsupported file type. Drop a .pgn, .txt, .fen, or board image.",
        });
      }
    };

    window.addEventListener("paste", onPaste);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDropCapture, true);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", clearDrag);
    window.addEventListener("blur", clearDrag);

    return () => {
      controller?.abort();
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDropCapture, true);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", clearDrag);
      window.removeEventListener("blur", clearDrag);
    };
  }, [setDialog]);

  return (
    <>
      {dragging && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: (theme) => theme.zIndex.modal + 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            border: "4px dashed",
            borderColor: "primary.main",
            pointerEvents: "none",
          }}
        >
          <Icon icon="mdi:tray-arrow-down" height={64} color="#fff" />
          <Typography variant="h5" color="#fff">
            Drop a PGN file or a picture of a board
          </Typography>
        </Box>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
            action={
              toast.pasteText ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    const initialText = toast.pasteText;
                    setToast(null);
                    setDialog({ open: true, initialText });
                  }}
                >
                  Open Import
                </Button>
              ) : undefined
            }
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
