import { createTheme } from "@mui/material/styles";
import type { StorageManager } from "@mui/system";
import { red } from "@mui/material/colors";
import { MAIN_THEME_COLOR } from "@/constants";

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: ".chesskit-%s" },
  defaultColorScheme: "dark",
  colorSchemes: {
    light: {
      palette: {
        mode: "light",
        error: { main: red[400] },
        primary: { main: MAIN_THEME_COLOR },
        secondary: { main: "#ffffff" },
        background: { default: "#f1f2f4", paper: "#ffffff" },
      },
    },
    dark: {
      palette: {
        mode: "dark",
        error: { main: red[400] },
        primary: { main: MAIN_THEME_COLOR },
        secondary: { main: "#2a2a31" },
        background: { default: "#131316", paper: "#1c1c21" },
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: { button: { textTransform: "none", fontWeight: 600 } },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
  },
});

// Retain the existing boolean preference, including existing installations.
export const themeStorage: StorageManager = ({ key, storageWindow }) => ({
  get(defaultValue) {
    try {
      const value = storageWindow?.localStorage.getItem(key);
      if (key === "useDarkMode") return value === "false" ? "light" : "dark";
      return value ?? defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set(value) {
    try {
      storageWindow?.localStorage.setItem(
        key,
        key === "useDarkMode" ? JSON.stringify(value === "dark") : value
      );
    } catch {
      // Theme switching still works when storage is unavailable.
    }
  },
  subscribe(handler) {
    const listener = (event: StorageEvent) => {
      if (event.key === key)
        handler(
          key === "useDarkMode"
            ? event.newValue === "false"
              ? "light"
              : "dark"
            : event.newValue
        );
    };
    storageWindow?.addEventListener("storage", listener);
    return () => storageWindow?.removeEventListener("storage", listener);
  },
});

export const themeInitScript =
  "try{document.documentElement.classList.add(localStorage.getItem('useDarkMode')==='false'?'chesskit-light':'chesskit-dark')}catch(e){document.documentElement.classList.add('chesskit-dark')}";
