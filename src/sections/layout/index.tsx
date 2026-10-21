import { Box, CssBaseline, ThemeProvider, useColorScheme } from "@mui/material";
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
  const { mode, setMode } = useColorScheme();
  const isDarkMode = mode !== "light";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const switchDarkMode = () => setMode(isDarkMode ? "light" : "dark");

  return (
    <>
      <CssBaseline enableColorScheme />
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
          <main style={{ margin: "2vh 1vw" }}>{children}</main>
        </Box>
      </Box>

      <GlobalDialogs />
      <CommandPalette switchDarkMode={switchDarkMode} />
      <GlobalImportListeners />
    </>
  );
}
