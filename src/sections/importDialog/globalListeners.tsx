import { detectInputAsync } from "@/lib/processing";
import { Icon } from "@iconify/react";
import { Box, Typography } from "@mui/material";
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

export default function GlobalImportListeners() {
  const setDialog = useSetAtom(importDialogAtom);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let dragDepth = 0;
    let controller: AbortController | undefined;
    const beginInput = () => {
      controller?.abort();
      controller = new AbortController();
      return controller;
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
      // No editable target: consume synchronously before awaiting the worker.
      event.preventDefault();
      try {
        if (
          (await detectInputAsync(text, request.signal)).kind !== "unknown" &&
          !request.signal.aborted
        )
          setDialog({ open: true, initialText: text });
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

    const onDrop = async (event: DragEvent) => {
      dragDepth = 0;
      setDragging(false);

      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      event.preventDefault();

      const request = beginInput();
      if (file.type.startsWith("image/")) {
        const image = await readAsDataUrl(file);
        if (!request.signal.aborted)
          setDialog({ open: true, initialImage: image });
      } else {
        const text = await file.text();
        if (!request.signal.aborted)
          setDialog({ open: true, initialText: text });
      }
    };

    window.addEventListener("paste", onPaste);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

    return () => {
      controller?.abort();
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [setDialog]);

  if (!dragging) return null;

  return (
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
  );
}
