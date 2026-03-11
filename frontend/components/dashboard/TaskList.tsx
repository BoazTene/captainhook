import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Button, Chip, Link, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { TodayTask } from "@/lib/today-tasks";

interface TaskListProps {
  tasks: TodayTask[];
  completedTaskIds?: Set<string>;
  onToggleDone?: (taskId: string) => void;
  onOpenDetails?: (task: TodayTask) => void;
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function renderTextWithLinks(text: string): ReactNode[] {
  return text.split(URL_PATTERN).filter(Boolean).map((part, index) => {
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <Link key={`${part}-${index}`} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </Link>
      );
    }

    return part;
  });
}

export function TaskList({ tasks, completedTaskIds, onToggleDone, onOpenDetails }: TaskListProps) {
  return (
    <Stack spacing={1.5}>
      {tasks.map((task) => {
        const isDone = completedTaskIds?.has(task.id) ?? false;

        return (
          <Paper key={task.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, opacity: isDone ? 0.78 : 1 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                <Chip label={`${task.plugin} plugin`} size="small" color="secondary" />
                {task.type !== "none" && <Chip label={task.type} size="small" variant="outlined" />}
                {isDone && <Chip label="Done" size="small" color="success" />}
              </Stack>
              <Typography variant="subtitle1" fontWeight={600}>
                {task.eventName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {task.summary}
              </Typography>
              {task.details.length > 0 && (
                <Stack spacing={0.5} sx={{ pl: 1 }}>
                  {task.details.slice(0, 2).map((detail) => (
                    <Typography key={detail} variant="caption" color="text.secondary">
                      • {renderTextWithLinks(detail)}
                    </Typography>
                  ))}
                </Stack>
              )}
              {onToggleDone && (
                <Button
                  variant={isDone ? "contained" : "outlined"}
                  color={isDone ? "success" : "primary"}
                  size="small"
                  onClick={() => onToggleDone(task.id)}
                  startIcon={<TaskAltRoundedIcon />}
                  sx={{ alignSelf: "flex-start", mt: 0.5 }}
                >
                  {isDone ? "Done" : "Mark done"}
                </Button>
              )}
              {onOpenDetails && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => onOpenDetails(task)}
                  startIcon={<LaunchRoundedIcon />}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Further details
                </Button>
              )}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
