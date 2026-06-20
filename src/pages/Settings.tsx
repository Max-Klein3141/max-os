import { AlertTriangle, Download, Plus, Quote, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { addQuote, DEFAULT_QUOTES, removeQuote } from "../lib/challenges";
import { STORAGE_KEYS } from "../lib/storage";
import {
  emptyDatabase,
  getDatabase,
  replaceDatabase,
  useSlice,
} from "../lib/store";
import type { Database } from "../types";

const BACKUP_APP = "MAX OS";

function exportData() {
  const payload = {
    app: BACKUP_APP,
    version: 1,
    exportedAt: new Date().toISOString(),
    data: getDatabase(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `max-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function estimateBytes(): number {
  let total = 0;
  for (const key of Object.values(STORAGE_KEYS)) {
    total += (localStorage.getItem(key)?.length ?? 0) * 2;
  }
  return total;
}

export default function Settings() {
  const quotes = useSlice("quotes");
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [newQuote, setNewQuote] = useState("");
  const [newAuthor, setNewAuthor] = useState("");

  function onImport(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const data: Partial<Database> = parsed?.data ?? parsed;
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Unrecognized file");
        }
        if (
          !window.confirm(
            "Importing will replace all current data in MAX OS. Continue?",
          )
        ) {
          return;
        }
        replaceDatabase(data);
        setStatus("Backup imported successfully.");
      } catch {
        setStatus("That file couldn't be read as a MAX OS backup.");
      }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    if (
      window.confirm(
        "Erase ALL MAX OS data? This cannot be undone. Consider exporting a backup first.",
      )
    ) {
      replaceDatabase(emptyDatabase());
      setStatus("All data cleared.");
    }
  }

  const kb = (estimateBytes() / 1024).toFixed(1);

  return (
    <div>
      <PageHeader
        title="Data"
        subtitle="Everything lives locally in your browser. Back it up regularly."
      />

      {status && (
        <div className="mb-5 rounded-lg border border-indigo-400/30 bg-indigo-400/10 px-4 py-2.5 text-sm text-indigo-200">
          {status}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold text-white">Backup & restore</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Export a full JSON snapshot, or restore from a previous backup.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={exportData}>
              <Download size={15} /> Export data
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Import backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                onImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <p className="mt-4 text-xs text-zinc-600">
            Local storage in use: ~{kb} KB
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <Quote size={16} className="text-indigo-400" /> Challenge quotes
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {DEFAULT_QUOTES.length} built-in + {quotes.length} of your own. These
            feed the daily challenge.
          </p>
          <div className="mt-4 space-y-2">
            <textarea
              value={newQuote}
              onChange={(e) => setNewQuote(e.target.value)}
              rows={2}
              placeholder="Add a quote to memorize…"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                placeholder="Author (optional)"
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
              />
              <Button
                variant="primary"
                disabled={!newQuote.trim()}
                onClick={() => {
                  addQuote(newQuote, newAuthor);
                  setNewQuote("");
                  setNewAuthor("");
                }}
              >
                <Plus size={15} /> Add
              </Button>
            </div>
          </div>
          {quotes.length > 0 && (
            <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto pr-1">
              {quotes.map((q) => (
                <li
                  key={q.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-zinc-800/60 px-3 py-2"
                >
                  <span className="text-sm text-zinc-300">
                    “{q.text}”
                    {q.author && (
                      <span className="text-zinc-600"> — {q.author}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeQuote(q.id)}
                    className="shrink-0 text-zinc-700 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="border-red-500/20 p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <AlertTriangle size={16} className="text-red-400" /> Danger zone
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Permanently erase all habits, journals, goals, knowledge, and logs.
          </p>
          <Button variant="danger" className="mt-4" onClick={resetAll}>
            <Trash2 size={15} /> Erase all data
          </Button>
        </Card>
      </div>
    </div>
  );
}
