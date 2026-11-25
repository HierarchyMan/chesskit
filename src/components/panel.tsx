import { Icon } from "@iconify/react";
import { Box, BoxProps, Typography } from "@mui/material";
import { ReactNode } from "react";
import { useInBoardInspector } from "./boardWorkspace";

interface Props extends Omit<BoxProps, "title"> {
  title?: ReactNode;
  icon?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function Panel({
  title,
  icon,
  actions,
  children,
  sx,
  ...rest
}: Props) {
  const inInspector = useInBoardInspector();
  return (
    <Box
      sx={[
        (theme) => ({
          backgroundColor: "background.paper",
          border: 1,
          borderColor: "divider",
          borderRadius: 1.5,
          p: 2,
          boxShadow:
            theme.palette.mode === "dark"
              ? "0 1px 4px rgba(0, 0, 0, 0.18)"
              : "0 1px 3px rgba(0, 0, 0, 0.06)",
          ...(inInspector
            ? {
                border: 0,
                borderBottom: 1,
                borderColor: "divider",
                borderRadius: 0,
                boxShadow: "none",
                p: 1.5,
                "&:last-of-type": {
                  borderBottom: 0,
                },
              }
            : {}),
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      {(title || icon || actions) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mb: 1.25,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              minWidth: 0,
            }}
          >
            {icon && (
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  color: "text.secondary",
                  flexShrink: 0,
                }}
              >
                <Icon icon={icon} width={18} height={18} />
              </Box>
            )}
            {typeof title === "string" ? (
              <Typography fontWeight={600} noWrap>
                {title}
              </Typography>
            ) : (
              title
            )}
          </Box>
          {actions}
        </Box>
      )}
      {children}
    </Box>
  );
}
