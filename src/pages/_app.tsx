import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@/lib/icons";
import { AppProps } from "next/app";
import Layout from "@/sections/layout";
import { startModelStorage } from "@/hooks/useModels";
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
      {inBrowser ? <ChessboardDnDProvider>{app}</ChessboardDnDProvider> : app}
    </QueryClientProvider>
  );
}
