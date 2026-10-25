import {
  Box,
  CssBaseline,
  GlobalStyles,
  ThemeProvider,
  useColorScheme,
} from "@mui/material";
import { useRouter } from "next/router";
import { PropsWithChildren, useState } from "react";
import NavBar from "./NavBar";
import NavMenu from "./NavMenu";
import CommandPalette from "./commandPalette";
import { theme, themeStorage } from "./theme";
import GlobalDialogs from "./dialogs";
import GlobalImportListeners from "../importDialog/globalListeners";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <ThemeProvider
      theme={theme}
      defaultMode="dark"
      modeStorageKey="useDarkMode"
      storageManager={themeStorage}
    >
      <LayoutBody>{children}</LayoutBody>
    </ThemeProvider>
  );
}

function LayoutBody({ children }: PropsWithChildren) {
  const { pathname } = useRouter();
  const workspace = [
    "/analysis",
    "/editor",
    "/play",
    "/arena",
    "/puzzles",
    "/openings",
    "/vision",
  ].includes(pathname);
  const { mode, setMode } = useColorScheme();
  const isDarkMode = mode !== "light";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const switchDarkMode = () => setMode(isDarkMode ? "light" : "dark");

  return (
    <>
      <CssBaseline enableColorScheme />
      <GlobalStyles
        styles={{
          html: { scrollbarGutter: "stable" },
          '[data-motion-board] [style*="position: fixed"]': {
            zIndex: "30 !important",
          },
          '[data-motion-board]:has([title="Choose promotion piece"]) > div:first-of-type':
            {
              position: "relative",
              zIndex: 30,
            },
          '[data-motion-board]:has([title="Choose promotion piece"]) [data-piece-presentation]':
            {
              visibility: "hidden",
            },
          '[data-motion-board]:has([title="Choose promotion piece"]) [data-static-piece]':
            {
              visibility: "visible !important",
            },
          '[data-motion-board] [title="Choose promotion piece"]': {
            top: "50% !important",
            left: "50% !important",
            transform: "translate(-50%, -50%) !important",
          },
        }}
      />
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        <NavMenu
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <NavBar
            darkMode={isDarkMode}
            switchDarkMode={switchDarkMode}
            onMenuClick={() => setMobileMenuOpen(true)}
          />
          <main
            style={
              workspace ? { padding: 12, minWidth: 0 } : { margin: "2vh 1vw" }
            }
          >
            {children}
          </main>
        </Box>
      </Box>

      <GlobalDialogs />
      <CommandPalette switchDarkMode={switchDarkMode} />
      <GlobalImportListeners />
    </>
  );
}
