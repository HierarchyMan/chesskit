import { detectInput } from "@/lib/pgn";
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
  !!event.dataTransfer && Array.from(event.dataTransfer.types).includes("Files");

export default function GlobalImportListeners() {
  const setDialog = useSetAtom(importDialogAtom);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let dragDepth = 0;

    const onPaste = async (event: ClipboardEvent) => {
      if (isTextField(event.target) || !event.clipboardData) return;

      const imageFile = Array.from(event.clipboardData.files).find((file) =>
        file.type.startsWith("image/")
      );
      if (imageFile) {
        event.preventDefault();
        setDialog({ open: true, initialImage: await readAsDataUrl(imageFile) });
        return;
      }

      const text = event.clipboardData.getData("text/plain");
      if (detectInput(text).kind !== "unknown") {
        event.preventDefault();
        setDialog({ open: true, initialText: text });
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

      if (file.type.startsWith("image/")) {
        setDialog({ open: true, initialImage: await readAsDataUrl(file) });
      } else {
        setDialog({ open: true, initialText: await file.text() });
      }
    };

    window.addEventListener("paste", onPaste);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

    return () => {
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
