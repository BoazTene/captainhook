import { useRef } from "react";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { Box, IconButton, Paper, Typography } from "@mui/material";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getCalendarCells(date: Date): Array<number | null> {
  const year = date.getFullYear();
  const month = date.getMonth();

  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayFirstOffset = (monthStart.getDay() + 6) % 7;

  const cells: Array<number | null> = [];

  for (let i = 0; i < mondayFirstOffset; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

interface CalendarViewProps {
  displayMonth: Date;
  selectedDate: Date;
  today: Date;
  eventDateKeys?: Set<string>;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: Date) => void;
  onDateContextMenu?: (payload: { date: Date; mouseX: number; mouseY: number }) => void;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CalendarView({
  displayMonth,
  selectedDate,
  today,
  eventDateKeys,
  onPreviousMonth,
  onNextMonth,
  onSelectDate,
  onDateContextMenu,
}: CalendarViewProps) {
  const cells = getCalendarCells(displayMonth);
  const longPressTimeoutRef = useRef<number | null>(null);

  const clearLongPress = () => {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <IconButton size="small" onClick={onPreviousMonth} aria-label="Previous month">
            <ChevronLeftRoundedIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={600}>
            {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(displayMonth)}
          </Typography>
          <IconButton size="small" onClick={onNextMonth} aria-label="Next month">
            <ChevronRightRoundedIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Pick a date
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 1 }}>
        {weekdayLabels.map((label) => (
          <Typography key={label} variant="caption" color="text.secondary" align="center" sx={{ fontWeight: 700 }}>
            {label}
          </Typography>
        ))}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 1, mt: 1 }}>
        {cells.map((day, index) => {
          const cellDate =
            day !== null
              ? new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day)
              : null;
          const isToday = cellDate ? isSameDay(cellDate, today) : false;
          const isSelected = cellDate ? isSameDay(cellDate, selectedDate) : false;
          const dateKey = cellDate ? toLocalDateKey(cellDate) : null;
          const hasEvents = dateKey ? eventDateKeys?.has(dateKey) ?? false : false;
          return (
            <Box
              key={`${day ?? "empty"}-${index}`}
              onClick={() => {
                if (cellDate) {
                  onSelectDate(cellDate);
                }
              }}
              onContextMenu={(event) => {
                if (!cellDate || !onDateContextMenu) {
                  return;
                }

                event.preventDefault();
                onDateContextMenu({
                  date: cellDate,
                  mouseX: event.clientX,
                  mouseY: event.clientY,
                });
              }}
              onTouchStart={(event) => {
                if (!cellDate || !onDateContextMenu) {
                  return;
                }

                const touch = event.touches[0];
                longPressTimeoutRef.current = window.setTimeout(() => {
                  onDateContextMenu({
                    date: cellDate,
                    mouseX: touch.clientX,
                    mouseY: touch.clientY,
                  });
                  longPressTimeoutRef.current = null;
                }, 450);
              }}
              onTouchEnd={clearLongPress}
              onTouchMove={clearLongPress}
              onTouchCancel={clearLongPress}
              sx={{
                aspectRatio: "1 / 1",
                borderRadius: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: day ? "1px solid" : "none",
                borderColor: isSelected ? "primary.main" : "divider",
                typography: { xs: "body2", sm: "body1" },
                bgcolor: isSelected ? "primary.main" : day ? "background.paper" : "transparent",
                color: isSelected ? "primary.contrastText" : "text.primary",
                fontWeight: isToday || isSelected ? 700 : 500,
                cursor: day ? "pointer" : "default",
                outline: isToday && !isSelected ? "1px solid" : "none",
                outlineColor: "primary.main",
              }}
            >
              <Box component="span">{day ?? ""}</Box>
              {hasEvents && (
                <Box
                  sx={{
                    mt: 0.35,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: isSelected ? "primary.contrastText" : "secondary.main",
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
