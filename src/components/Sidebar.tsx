import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { NAV, SETTINGS_ITEM } from "../views";
import type { NavItem, ViewKey } from "../views";

interface SidebarProps {
  active: ViewKey;
  onNavigate: (key: ViewKey) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100",
      )}
    >
      <Icon
        size={17}
        className={active ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300"}
      />
      {item.label}
    </button>
  );
}

function SidebarBody({
  active,
  onNavigate,
}: {
  active: ViewKey;
  onNavigate: (key: ViewKey) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="px-3 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-sm font-black text-zinc-950">
            M
          </span>
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-white">
            Max OS
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            active={active === item.key}
            onClick={() => onNavigate(item.key)}
          />
        ))}
      </nav>

      <div className="border-t border-zinc-800 pt-2">
        <NavButton
          item={SETTINGS_ITEM}
          active={active === SETTINGS_ITEM.key}
          onClick={() => onNavigate(SETTINGS_ITEM.key)}
        />
      </div>
    </div>
  );
}

export function Sidebar({
  active,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {/* Desktop: static rail */}
      <aside className="hidden w-60 shrink-0 border-r border-zinc-800 bg-zinc-950 md:block">
        <SidebarBody active={active} onNavigate={onNavigate} />
      </aside>

      {/* Mobile: slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onCloseMobile}
          />
          <aside className="animate-fade-in absolute left-0 top-0 h-full w-64 border-r border-zinc-800 bg-zinc-950">
            <button
              type="button"
              onClick={onCloseMobile}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <SidebarBody active={active} onNavigate={onNavigate} />
          </aside>
        </div>
      )}
    </>
  );
}
