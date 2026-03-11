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
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  GlobalStyles,
  Grid,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
  type PaletteMode,
} from "@mui/material";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TodayTask } from "@/lib/today-tasks";
import { mapEventsToTasks, type ApiEvent } from "@/lib/events";
import { CalendarView } from "./CalendarView";
import { NotificationControl } from "./NotificationControl";
import { TaskList } from "./TaskList";

type EventRepeat = "none" | "daily" | "weekly" | "monthly" | "yearly";

interface CreateEventFormState {
  name: string;
  description: string;
  plugin: string;
  date: string;
  repeat: EventRepeat;
}

interface ApiEventPluginResponse {
  event_id: number;
  event_name: string;
  plugin: string;
  task: Record<string, unknown>;
}

interface ModalDetails {
  type: string;
  summary: string;
  fullSession: string[];
}

interface DateMenuState {
  mouseX: number;
  mouseY: number;
  date: Date;
}

function toDateTimeLocalValue(date: Date): string {
  const localDate = new Date(date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  const hours = String(localDate.getHours()).padStart(2, "0");
  const minutes = String(localDate.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function withDefaultEventTime(date: Date): Date {
  const next = new Date(date);
  next.setHours(9, 0, 0, 0);
  return next;
}

function toLocalDateTimeQueryValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T12:00:00`;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function mapPluginTaskToModalDetails(task: Record<string, unknown>, fallback: TodayTask): ModalDetails {
  const sentences = asStringArray(task.sentences);
  const notes = asStringArray(task.notes);
  const sessionPlan = asStringArray(task.session_plan);

  const summaryCandidate =
    (typeof task.summary === "string" && task.summary) ||
    (typeof task.workout === "string" && task.workout) ||
    sentences[0] ||
    notes[0] ||
    fallback.summary;

  const fullSession = sessionPlan.length > 0 ? sessionPlan : [...sentences, ...notes];

  return {
    type: typeof task.type === "string" ? task.type : fallback.type,
    summary: summaryCandidate,
    fullSession: fullSession.length > 0 ? fullSession : fallback.fullSession,
  };
}

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
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [monthEventDateKeys, setMonthEventDateKeys] = useState<Set<string>>(new Set());
  const [tasksLoading, setTasksLoading] = useState<boolean>(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<DateMenuState | null>(null);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState<boolean>(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState<boolean>(false);
  const [createEventError, setCreateEventError] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [isDayEventsOpen, setIsDayEventsOpen] = useState<boolean>(false);
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null);
  const [deleteEventError, setDeleteEventError] = useState<string | null>(null);
  const [availablePlugins, setAvailablePlugins] = useState<string[]>([]);
  const [modalDetails, setModalDetails] = useState<ModalDetails | null>(null);
  const [modalDetailsLoading, setModalDetailsLoading] = useState<boolean>(false);
  const [modalDetailsError, setModalDetailsError] = useState<string | null>(null);
  const [createEventForm, setCreateEventForm] = useState<CreateEventFormState>({
    name: "",
    description: "",
    plugin: "none",
    date: toDateTimeLocalValue(withDefaultEventTime(today)),
    repeat: "none",
  });
  const [calendarHeight, setCalendarHeight] = useState<number>(0);
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());

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

  const toggleTaskDone = async (taskId: string) => {
    try {
      setTasksError(null);
      const isCompleted = completedTaskIds.has(taskId);
      const response = await fetch(`/api/events/${taskId}/completion`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completed: !isCompleted, occurrence_date: toLocalDateKey(selectedDate) }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update event completion: ${response.status}`);
      }

      setCompletedTaskIds((prev) => {
        const next = new Set(prev);
        if (isCompleted) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
        return next;
      });
    } catch (error) {
      setTasksError(error instanceof Error ? error.message : "Failed to update event completion.");
    }
  };

  const openCreateEventModal = (date: Date) => {
    const baseDate = withDefaultEventTime(date);
    setCreateEventError(null);
    setEditingEventId(null);
    setCreateEventForm({
      name: "",
      description: "",
      plugin: "none",
      date: toDateTimeLocalValue(baseDate),
      repeat: "none",
    });
    setIsCreateEventOpen(true);
  };

  const openEditEventModal = (event: ApiEvent) => {
    setCreateEventError(null);
    setEditingEventId(event.id);
    setCreateEventForm({
      name: event.name,
      description: event.description,
      plugin: event.plugin ?? "none",
      date: toDateTimeLocalValue(new Date(event.original_date ?? event.date)),
      repeat: event.repeat,
    });
    setIsCreateEventOpen(true);
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadPlugins = async () => {
      try {
        const response = await fetch("/api/plugins", {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load plugins.");
        }

        const plugins = (await response.json()) as string[];
        setAvailablePlugins(plugins);
      } catch {
        if (!controller.signal.aborted) {
          setAvailablePlugins([]);
        }
      }
    };

    void loadPlugins();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadEvents = async () => {
      setTasksLoading(true);
      setTasksError(null);

      try {
        const params = new URLSearchParams({ date: toLocalDateTimeQueryValue(selectedDate) });
        const response = await fetch(`/api/events?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to load events: ${response.status}`);
        }

        const events = (await response.json()) as ApiEvent[];
        setEvents(events);
        setCompletedTaskIds(new Set(events.filter((event) => event.completed_at !== null).map((event) => String(event.id))));
        setTasks(mapEventsToTasks(events));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setEvents([]);
        setTasks([]);
        setCompletedTaskIds(new Set());
        setTasksError(error instanceof Error ? error.message : "Failed to load events.");
      } finally {
        if (!controller.signal.aborted) {
          setTasksLoading(false);
        }
      }
    };

    void loadEvents();

    return () => controller.abort();
  }, [selectedDate, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();

    const loadMonthEvents = async () => {
      try {
        const firstDayOfMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
        const lastDayOfMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0);
        const params = new URLSearchParams({
          date: toLocalDateTimeQueryValue(firstDayOfMonth),
          operator: "between",
          date_to: toLocalDateTimeQueryValue(lastDayOfMonth),
        });
        const response = await fetch(`/api/events?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to load month events: ${response.status}`);
        }

        const monthEvents = (await response.json()) as ApiEvent[];
        setMonthEventDateKeys(new Set(monthEvents.map((event) => toLocalDateKey(new Date(event.date)))));
      } catch {
        if (!controller.signal.aborted) {
          setMonthEventDateKeys(new Set());
        }
      }
    };

    void loadMonthEvents();

    return () => controller.abort();
  }, [displayMonth, refreshKey]);

  useEffect(() => {
    if (!openTask) {
      setModalDetails(null);
      setModalDetailsLoading(false);
      setModalDetailsError(null);
      return;
    }

    const event = events.find((item) => String(item.id) === openTask.id);
    if (!event?.plugin) {
      setModalDetails(null);
      setModalDetailsLoading(false);
      setModalDetailsError(null);
      return;
    }

    const controller = new AbortController();

    const loadPluginDetails = async () => {
      setModalDetailsLoading(true);
      setModalDetailsError(null);

      try {
        const response = await fetch(`/api/events/${openTask.id}/plugin`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to load plugin details: ${response.status}`);
        }

        const pluginPayload = (await response.json()) as ApiEventPluginResponse;
        setModalDetails(mapPluginTaskToModalDetails(pluginPayload.task, openTask));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setModalDetails(null);
        setModalDetailsError(error instanceof Error ? error.message : "Failed to load plugin details.");
      } finally {
        if (!controller.signal.aborted) {
          setModalDetailsLoading(false);
        }
      }
    };

    void loadPluginDetails();

    return () => controller.abort();
  }, [events, openTask]);

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

  const handleOpenDateContextMenu = (payload: { date: Date; mouseX: number; mouseY: number }) => {
    setSelectedDate(payload.date);
    setContextMenu(payload);
  };

  const closeDateContextMenu = () => {
    setContextMenu(null);
  };

  const handleOpenAddEventFromMenu = () => {
    if (!contextMenu) {
      return;
    }

    openCreateEventModal(contextMenu.date);
    closeDateContextMenu();
  };

  const handleOpenEditEventsFromMenu = () => {
    if (!contextMenu) {
      return;
    }

    setSelectedDate(contextMenu.date);
    setDisplayMonth(new Date(contextMenu.date.getFullYear(), contextMenu.date.getMonth(), 1));
    setIsDayEventsOpen(true);
    closeDateContextMenu();
  };

  const handleSaveEvent = async () => {
    setIsCreatingEvent(true);
    setCreateEventError(null);

    try {
      const payload = {
        name: createEventForm.name.trim(),
        description: createEventForm.description.trim(),
        plugin: createEventForm.plugin === "none" ? null : createEventForm.plugin,
        date: new Date(createEventForm.date).toISOString(),
        repeat: createEventForm.repeat,
      };

      const response = await fetch(editingEventId === null ? "/api/events" : `/api/events/${editingEventId}`, {
        method: editingEventId === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${editingEventId === null ? "create" : "update"} event: ${response.status}`);
      }

      const createdDate = new Date(createEventForm.date);
      setSelectedDate(createdDate);
      setDisplayMonth(new Date(createdDate.getFullYear(), createdDate.getMonth(), 1));
      setIsCreateEventOpen(false);
      setEditingEventId(null);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setCreateEventError(error instanceof Error ? error.message : `Failed to ${editingEventId === null ? "create" : "update"} event.`);
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    setDeletingEventId(eventId);
    setDeleteEventError(null);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete event: ${response.status}`);
      }

      if (editingEventId === eventId) {
        setIsCreateEventOpen(false);
        setEditingEventId(null);
      }

      if (openTask?.id === String(eventId)) {
        setOpenTask(null);
      }

      setRefreshKey((value) => value + 1);
    } catch (error) {
      setDeleteEventError(error instanceof Error ? error.message : "Failed to delete event.");
    } finally {
      setDeletingEventId(null);
    }
  };

  const selectedEvent = useMemo(
    () => (openTask ? events.find((event) => String(event.id) === openTask.id) ?? null : null),
    [events, openTask],
  );
  const selectedDateEvents = useMemo(
    () => [...events].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()),
    [events],
  );

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

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                  <NotificationControl />
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={toggleTheme}
                    startIcon={mode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
                  >
                    {mode === "light" ? "Switch to Dark" : "Switch to Light"}
                  </Button>
                </Stack>
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
                    </Box>
                  </Stack>
                  <Box
                    sx={{
                      minHeight: 0,
                      flex: { xs: "unset", md: 1 },
                      overflowY: { xs: "visible", md: "auto" },
                      pr: { md: 0.5 },
                    }}
                  >
                    {tasksLoading ? (
                      <Typography variant="body2" color="text.secondary">
                        Loading events...
                      </Typography>
                    ) : tasksError ? (
                      <Typography variant="body2" color="error.main">
                        {tasksError}
                      </Typography>
                    ) : tasks.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No events for this date.
                      </Typography>
                    ) : (
                      <TaskList
                        tasks={tasks}
                        completedTaskIds={completedTaskIds}
                        onToggleDone={(taskId) => void toggleTaskDone(taskId)}
                        onOpenDetails={setOpenTask}
                      />
                    )}
                  </Box>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 8 }} sx={{ order: { xs: 2, md: 1 } }}>
                <Box ref={calendarContainerRef}>
                  <CalendarView
                    displayMonth={displayMonth}
                    selectedDate={selectedDate}
                    today={today}
                    eventDateKeys={monthEventDateKeys}
                    onPreviousMonth={() => moveMonth(-1)}
                    onNextMonth={() => moveMonth(1)}
                    onSelectDate={setSelectedDate}
                    onDateContextMenu={handleOpenDateContextMenu}
                  />
                </Box>
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>
      <Menu
        open={Boolean(contextMenu)}
        onClose={closeDateContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
      >
        <MenuItem onClick={handleOpenAddEventFromMenu}>Add event</MenuItem>
        <MenuItem onClick={handleOpenEditEventsFromMenu}>Edit events</MenuItem>
      </Menu>
      <Dialog open={isDayEventsOpen} onClose={() => setIsDayEventsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Events</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25}>
            <Typography variant="body2" color="text.secondary">
              {new Intl.DateTimeFormat("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(selectedDate)}
            </Typography>
            {tasksLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading events...
              </Typography>
            ) : selectedDateEvents.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No scheduled events for this day.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {selectedDateEvents.map((event) => (
                  <Paper key={event.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {event.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Intl.DateTimeFormat("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(event.date))}
                          {" · "}
                          {event.repeat}
                        </Typography>
                      </Box>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} width={{ xs: "100%", sm: "auto" }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            openEditEventModal(event);
                            setIsDayEventsOpen(false);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          disabled={deletingEventId === event.id}
                          onClick={() => {
                            const confirmed = window.confirm(`Delete "${event.name}" permanently?`);
                            if (!confirmed) {
                              return;
                            }
                            void handleDeleteEvent(event.id);
                          }}
                        >
                          {deletingEventId === event.id ? "Deleting..." : "Delete"}
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
            {deleteEventError && (
              <Typography variant="body2" color="error.main">
                {deleteEventError}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDayEventsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={isCreateEventOpen}
        onClose={() => {
          setIsCreateEventOpen(false);
          setEditingEventId(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{editingEventId === null ? "Add Event" : "Edit Event"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              required
              value={createEventForm.name}
              onChange={(event) => setCreateEventForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <TextField
              label="Description"
              required
              multiline
              minRows={3}
              value={createEventForm.description}
              onChange={(event) =>
                setCreateEventForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
            <FormControl fullWidth>
              <InputLabel id="plugin-select-label">Plugin</InputLabel>
              <Select
                labelId="plugin-select-label"
                label="Plugin"
                value={createEventForm.plugin}
                onChange={(event) =>
                  setCreateEventForm((prev) => ({ ...prev, plugin: event.target.value }))
                }
              >
                <MenuItem value="none">None</MenuItem>
                {availablePlugins.map((pluginName) => (
                  <MenuItem key={pluginName} value={pluginName}>
                    {pluginName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Date and time"
              type="datetime-local"
              value={createEventForm.date}
              onChange={(event) => setCreateEventForm((prev) => ({ ...prev, date: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth>
              <InputLabel id="repeat-select-label">Repeat</InputLabel>
              <Select
                labelId="repeat-select-label"
                label="Repeat"
                value={createEventForm.repeat}
                onChange={(event) =>
                  setCreateEventForm((prev) => ({ ...prev, repeat: event.target.value as EventRepeat }))
                }
              >
                <MenuItem value="none">Once</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="yearly">Yearly</MenuItem>
              </Select>
            </FormControl>
            {createEventError && (
              <Typography variant="body2" color="error.main">
                {createEventError}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsCreateEventOpen(false);
              setEditingEventId(null);
            }}
            disabled={isCreatingEvent}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEvent}
            disabled={
              isCreatingEvent ||
              createEventForm.name.trim().length === 0 ||
              createEventForm.description.trim().length === 0 ||
              createEventForm.date.trim().length === 0
            }
          >
            {isCreatingEvent ? (editingEventId === null ? "Creating..." : "Saving...") : editingEventId === null ? "Create Event" : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(openTask)} onClose={() => setOpenTask(null)} fullWidth maxWidth="sm">
        {openTask && (
          <>
            <DialogTitle>{openTask.eventName}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip label={`${openTask.plugin} plugin`} size="small" color="secondary" />
                  {(modalDetails?.type ?? openTask.type) !== "none" && (
                    <Chip label={modalDetails?.type ?? openTask.type} size="small" variant="outlined" />
                  )}
                  {completedTaskIds.has(openTask.id) && <Chip label="Done" size="small" color="success" />}
                </Stack>
                {modalDetailsLoading ? (
                  <Typography variant="body2" color="text.secondary">
                    Loading full details...
                  </Typography>
                ) : null}
                {modalDetailsError ? (
                  <Typography variant="body2" color="error.main">
                    {modalDetailsError}
                  </Typography>
                ) : null}
                <Typography variant="body1">{modalDetails?.summary ?? openTask.summary}</Typography>
                <Typography variant="subtitle2" color="text.secondary">
                  Further details
                </Typography>
                <Stack spacing={0.8}>
                  {(modalDetails?.fullSession ?? openTask.fullSession).map((step, index) => (
                    <Typography key={`${openTask.id}-step-${index}`} variant="body2">
                      {index + 1}. {step}
                    </Typography>
                  ))}
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignSelf: "flex-start", mt: 0.8 }}>
                  <Button
                    variant={completedTaskIds.has(openTask.id) ? "contained" : "outlined"}
                    color={completedTaskIds.has(openTask.id) ? "success" : "primary"}
                    startIcon={<TaskAltRoundedIcon />}
                    onClick={() => void toggleTaskDone(openTask.id)}
                  >
                    {completedTaskIds.has(openTask.id) ? "Done" : "Mark done"}
                  </Button>
                  {selectedEvent && (
                    <Button
                      variant="text"
                      onClick={() => {
                        openEditEventModal(selectedEvent);
                        setOpenTask(null);
                      }}
                    >
                      Edit event
                    </Button>
                  )}
                </Stack>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </ThemeProvider>
  );
}
