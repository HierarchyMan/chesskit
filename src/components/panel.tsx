import { Box, BoxProps, Typography } from "@mui/material";
import { ReactNode } from "react";

interface Props extends Omit<BoxProps, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export default function Panel({
  title,
  actions,
  children,
  sx,
  ...rest
}: Props) {
  return (
    <Box
      sx={{
        backgroundColor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 3,
        p: 2,
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.25)",
        ...sx,
      }}
      {...rest}
    >
      {(title || actions) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mb: 1.5,
          }}
        >
          {typeof title === "string" ? (
            <Typography fontWeight={600}>{title}</Typography>
          ) : (
            title
          )}
          {actions}
        </Box>
      )}
      {children}
    </Box>
  );
}
