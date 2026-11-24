import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@/lib/icons";
import { AppProps } from "next/app";
import Layout from "@/sections/layout";
import { startModelStorage } from "@/hooks/useModels";
import { GlobalStyles } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChessboardDnDProvider } from "react-chessboard";

const queryClient = new QueryClient();

export default function MyApp({ Component, pageProps }: AppProps) {
  // The drag-and-drop provider reads `window` as it renders, so it starts only
  // in the browser.
  const [inBrowser, setInBrowser] = useState(false);
  useEffect(() => {
    void startModelStorage();
    setInBrowser(true);
  }, []);

  const app = (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );

  // One drag-and-drop backend for the whole app. A second one, such as the
  // preview in Settings, would be a second HTML5 backend and React DnD refuses it.
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalStyles
        styles={{
          "@keyframes ckShake": {
            "0%, 100%": { transform: "translateX(0)" },
            "20%": { transform: "translateX(-4px)" },
            "40%": { transform: "translateX(4px)" },
            "60%": { transform: "translateX(-3px)" },
            "80%": { transform: "translateX(2px)" },
          },
          "@keyframes ckSpin": {
            "0%": { transform: "rotate(0deg) scale(1)" },
            "50%": { transform: "rotate(180deg) scale(1.08)" },
            "100%": { transform: "rotate(360deg) scale(1)" },
          },
          "@keyframes ckFloat": {
            "0%": { opacity: 0, transform: "translateY(6px) scale(0.85)" },
            "20%": { opacity: 1, transform: "translateY(0px) scale(1)" },
            "80%": { opacity: 1, transform: "translateY(-8px) scale(1)" },
            "100%": { opacity: 0, transform: "translateY(-14px) scale(0.95)" },
          },
          "@keyframes ckHighlightPulse": {
            "0%, 100%": { opacity: 1 },
            "50%": { opacity: 0.62 },
          },
          "@keyframes ckWiggle": {
            "0%, 100%": { transform: "translateX(0)" },
            "25%": { transform: "translateX(-3px)" },
            "75%": { transform: "translateX(3px)" },
          },
          ".ck-effect-shake": {
            animation: "ckShake 420ms ease-in-out",
          },
          ".ck-effect-spin": {
            animation: "ckSpin 680ms cubic-bezier(0.22, 1, 0.36, 1)",
          },
          ".ck-effect-float": {
            animation: "ckFloat 1100ms ease-out forwards",
          },
          ".ck-highlight-pulse": {
            animation: "ckHighlightPulse 1500ms ease-in-out infinite",
          },
          ".ck-wiggle": {
            animation: "ckWiggle 320ms ease-in-out",
          },
          "@media (prefers-reduced-motion: reduce)": {
            ".ck-effect-shake, .ck-effect-spin, .ck-effect-float, .ck-highlight-pulse, .ck-wiggle":
              {
                animation: "none !important",
              },
          },
        }}
      />
      {inBrowser ? <ChessboardDnDProvider>{app}</ChessboardDnDProvider> : app}
    </QueryClientProvider>
  );
}
