import {
  BarChart3,
  Brain,
  CalendarCheck,
  Database,
  Flame,
  Home,
  NotebookPen,
  Target,
} from "lucide-react";
import type { ComponentType } from "react";

export type ViewKey =
  | "today"
  | "habits"
  | "journal"
  | "planner"
  | "knowledge"
  | "analytics"
  | "weekly"
  | "settings";

export interface NavItem {
  key: ViewKey;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

/** Primary navigation, in order. */
export const NAV: NavItem[] = [
  { key: "today", label: "Today", icon: Home },
  { key: "habits", label: "Habits", icon: Flame },
  { key: "journal", label: "Journal", icon: NotebookPen },
  { key: "planner", label: "Planner & Goals", icon: Target },
  { key: "knowledge", label: "Knowledge Base", icon: Brain },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "weekly", label: "Weekly Review", icon: CalendarCheck },
];

/** Pinned to the bottom of the sidebar. */
export const SETTINGS_ITEM: NavItem = {
  key: "settings",
  label: "Data",
  icon: Database,
};
