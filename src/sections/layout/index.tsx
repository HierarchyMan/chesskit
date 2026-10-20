import { Box, CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { PropsWithChildren, useMemo, useState } from "react";
import NavBar from "./NavBar";
import NavMenu from "./NavMenu";
import CommandPalette from "./commandPalette";
import { red } from "@mui/material/colors";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { MAIN_THEME_COLOR } from "@/constants";
import SettingsDialog from "../settings/settingsDialog";
import SmartImportDialog from "../importDialog/smartImportDialog";
import GlobalImportListeners from "../importDialog/globalListeners";
import MoveStoryDialog from "@/components/moveStoryDialog";

export default function Layout({ children }: PropsWithChildren) {
  const [isDarkMode, setDarkMode] = useLocalStorage("useDarkMode", true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDarkMode ? "dark" : "light",
          error: {
            main: red[400],
          },
          primary: {
            main: MAIN_THEME_COLOR,
          },
          secondary: {
            main: isDarkMode ? "#2a2a31" : "#ffffff",
          },
          background: isDarkMode
            ? { default: "#131316", paper: "#1c1c21" }
            : { default: "#f1f2f4", paper: "#ffffff" },
        },
        shape: { borderRadius: 10 },
        typography: {
          button: { textTransform: "none", fontWeight: 600 },
        },
        components: {
          MuiButton: { defaultProps: { disableElevation: true } },
          MuiTooltip: { defaultProps: { arrow: true } },
          MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
          MuiDialog: {
            styleOverrides: { paper: { borderRadius: 16 } },
          },
        },
      }),
    [isDarkMode]
  );

  if (isDarkMode === null) return null;

  const switchDarkMode = () => setDarkMode((value) => !value);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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

      <SettingsDialog />
      <SmartImportDialog />
      <CommandPalette switchDarkMode={switchDarkMode} />
      <GlobalImportListeners />
      <MoveStoryDialog />
    </ThemeProvider>
  );
}
