"use client";

import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import {
  Box,
  Button,
  Chip,
  Container,
  createTheme,
  CssBaseline,
  Dialog,
  DialogContent,
  DialogTitle,
  GlobalStyles,
  Grid,
  Paper,
  Stack,
  ThemeProvider,
  Typography,
  type PaletteMode,
} from "@mui/material";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TodayTask } from "@/lib/today-tasks";
import { getMockTasksForDate } from "@/lib/today-tasks";
import { CalendarView } from "./CalendarView";
import { TaskList } from "./TaskList";

export function MissionDashboard() {
  const [mode, setMode] = useState<PaletteMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const stored = window.localStorage.getItem("captainhook-theme");
    if (stored === "dark" || stored === "light") {
      return stored;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [displayMonth, setDisplayMonth] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [openTask, setOpenTask] = useState<TodayTask | null>(null);
  const [calendarHeight, setCalendarHeight] = useState<number>(0);
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);
  const [completedByDate, setCompletedByDate] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") {
      return {};
    }

    const raw = window.localStorage.getItem("captainhook-completed-by-date");
    if (!raw) {
      return {};
    }

    try {
      return JSON.parse(raw) as Record<string, string[]>;
    } catch {
      return {};
    }
  });

  const tasks = useMemo(() => getMockTasksForDate(selectedDate), [selectedDate]);
  const selectedDateKey = useMemo(() => selectedDate.toISOString().slice(0, 10), [selectedDate]);
  const completedTaskIds = useMemo(
    () => new Set(completedByDate[selectedDateKey] ?? []),
    [completedByDate, selectedDateKey],
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: mode === "dark" ? "#14b8a6" : "#0f766e",
          },
          secondary: {
            main: mode === "dark" ? "#60a5fa" : "#2563eb",
          },
          background: {
            default: mode === "dark" ? "#0a121c" : "#f4f7fb",
            paper: mode === "dark" ? "#121d2a" : "#ffffff",
          },
        },
        shape: {
          borderRadius: 14,
        },
      }),
    [mode],
  );

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      window.localStorage.setItem("captainhook-theme", next);
      return next;
    });
  };

  const moveMonth = (direction: -1 | 1) => {
    setDisplayMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1),
    );
  };

  const toggleTaskDone = (taskId: string) => {
    setCompletedByDate((prev) => {
      const current = new Set(prev[selectedDateKey] ?? []);
      if (current.has(taskId)) {
        current.delete(taskId);
      } else {
        current.add(taskId);
      }

      return { ...prev, [selectedDateKey]: [...current] };
    });
  };

  useEffect(() => {
    window.localStorage.setItem("captainhook-completed-by-date", JSON.stringify(completedByDate));
  }, [completedByDate]);

  useEffect(() => {
    const node = calendarContainerRef.current;
    if (!node) {
      return;
    }

    const updateHeight = () => {
      setCalendarHeight(node.getBoundingClientRect().height);
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [displayMonth]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={(muiTheme) => ({
          html: { minHeight: "100%", backgroundColor: muiTheme.palette.background.default },
          body: { minHeight: "100%", backgroundColor: muiTheme.palette.background.default },
        })}
      />
      <Box sx={{ minHeight: "100vh", backgroundColor: "background.default" }}>
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={2.5}>
            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      component="img"
                      src="/favicon.ico"
                      alt="CaptainHook logo"
                      sx={{ width: 18, height: 18, borderRadius: 0.8 }}
                    />
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.8 }}>
                      CaptainHook
                    </Typography>
                  </Stack>
                  <Typography variant="h4" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" }, fontWeight: 700 }}>
                    Today&apos;s Mission
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Selected date: {new Intl.DateTimeFormat("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    }).format(selectedDate)}
                  </Typography>
                </Box>

                <Button
                  variant="outlined"
                  color="primary"
                  onClick={toggleTheme}
                  startIcon={mode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
                >
                  {mode === "light" ? "Switch to Dark" : "Switch to Light"}
                </Button>
              </Stack>
            </Paper>

            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 4 }} sx={{ order: { xs: 1, md: 2 } }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 2, sm: 3 },
                    borderRadius: 3,
                    height: { xs: "auto", md: calendarHeight > 0 ? `${calendarHeight}px` : "auto" },
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    justifyContent="space-between"
                    spacing={1.5}
                  >
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        Events For Selected Day
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Quick view cards. Open each item for full session details.
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, mb: 2 }}>
                    This panel will later be fed by FastAPI `GET /today?date=YYYY-MM-DD`.
                  </Typography>
                  <Box
                    sx={{
                      minHeight: 0,
                      flex: { xs: "unset", md: 1 },
                      overflowY: { xs: "visible", md: "auto" },
                      pr: { md: 0.5 },
                    }}
                  >
                    <TaskList
                      tasks={tasks}
                      completedTaskIds={completedTaskIds}
                      onToggleDone={toggleTaskDone}
                      onOpenDetails={setOpenTask}
                    />
                  </Box>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 8 }} sx={{ order: { xs: 2, md: 1 } }}>
                <Box ref={calendarContainerRef}>
                  <CalendarView
                    displayMonth={displayMonth}
                    selectedDate={selectedDate}
                    today={today}
                    onPreviousMonth={() => moveMonth(-1)}
                    onNextMonth={() => moveMonth(1)}
                    onSelectDate={setSelectedDate}
                  />
                </Box>
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>
      <Dialog open={Boolean(openTask)} onClose={() => setOpenTask(null)} fullWidth maxWidth="sm">
        {openTask && (
          <>
            <DialogTitle>{openTask.eventName}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip label={`${openTask.plugin} plugin`} size="small" color="secondary" />
                  <Chip label={openTask.type} size="small" variant="outlined" />
                  {completedTaskIds.has(openTask.id) && <Chip label="Done" size="small" color="success" />}
                </Stack>
                <Typography variant="body1">{openTask.summary}</Typography>
                <Typography variant="subtitle2" color="text.secondary">
                  Full session
                </Typography>
                <Stack spacing={0.8}>
                  {openTask.fullSession.map((step, index) => (
                    <Typography key={`${openTask.id}-step-${index}`} variant="body2">
                      {index + 1}. {step}
                    </Typography>
                  ))}
                </Stack>
                <Button
                  variant={completedTaskIds.has(openTask.id) ? "contained" : "outlined"}
                  color={completedTaskIds.has(openTask.id) ? "success" : "primary"}
                  startIcon={<TaskAltRoundedIcon />}
                  onClick={() => toggleTaskDone(openTask.id)}
                  sx={{ alignSelf: "flex-start", mt: 0.8 }}
                >
                  {completedTaskIds.has(openTask.id) ? "Done" : "Mark done"}
                </Button>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </ThemeProvider>
  );
}
