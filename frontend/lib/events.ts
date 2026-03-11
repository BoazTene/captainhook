import type { TodayTask } from "@/lib/today-tasks";

export interface ApiEvent {
  id: number;
  name: string;
  description: string;
  plugin: string | null;
  date: string;
  original_date: string | null;
  repeat: "none" | "daily" | "weekly" | "monthly" | "yearly";
  completed_at: string | null;
  created_at: string;
}

export function mapEventsToTasks(events: ApiEvent[]): TodayTask[] {
  return events.map((event) => ({
    id: String(event.id),
    eventName: event.name,
    plugin: event.plugin ?? "event",
    type: event.repeat,
    summary: event.description,
    details: [],
    fullSession: [event.description],
  }));
}
