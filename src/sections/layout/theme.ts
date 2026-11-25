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
  shape: { borderRadius: 8 },
  typography: { button: { textTransform: "none", fontWeight: 600 } },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        outlined: {
          borderColor: "var(--mui-palette-divider)",
          "&:hover": {
            backgroundColor: "var(--mui-palette-action-hover)",
          },
        },
        outlinedInherit: {
          borderColor: "var(--mui-palette-divider)",
          "&:hover": {
            borderColor: "var(--mui-palette-text-secondary)",
            backgroundColor: "var(--mui-palette-action-hover)",
          },
        },
        outlinedPrimary: {
          borderColor: "rgba(59, 154, 198, 0.45)",
          "&:hover": {
            borderColor: MAIN_THEME_COLOR,
            backgroundColor: "rgba(59, 154, 198, 0.1)",
          },
        },
        outlinedError: {
          borderColor: "rgba(239, 83, 80, 0.45)",
          "&:hover": {
            borderColor: red[400],
            backgroundColor: "rgba(239, 83, 80, 0.1)",
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 600,
          borderColor: "var(--mui-palette-divider)",
          "&:hover": {
            backgroundColor: "var(--mui-palette-action-hover)",
          },
          "&.Mui-selected": {
            backgroundColor: "rgba(59, 154, 198, 0.16)",
            color: MAIN_THEME_COLOR,
            borderColor: "rgba(59, 154, 198, 0.4)",
            "&:hover": {
              backgroundColor: "rgba(59, 154, 198, 0.24)",
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
        outlined: {
          borderColor: "var(--mui-palette-divider)",
        },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true, enterDelay: 350 },
      styleOverrides: {
        tooltip: {
          borderRadius: 6,
          fontSize: "0.75rem",
          fontWeight: 500,
          padding: "5px 9px",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: "var(--mui-palette-divider)" },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: "1px solid var(--mui-palette-divider)",
        },
      },
    },
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
