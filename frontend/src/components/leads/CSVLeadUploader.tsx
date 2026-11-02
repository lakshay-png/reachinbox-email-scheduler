
"use client";

import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, X, Loader2 } from "lucide-react";
import {
  parseLeadCSV,
  type LeadParseResult,
} from "@/lib/csv/lead-parser";

interface CSVLeadUploaderProps {
  onParsed: (result: LeadParseResult) => void;
}

export default function CSVLeadUploader({
  onParsed,
}: CSVLeadUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);

  async function handleFile(file?: File) {
    if (!file) return;

    setError("");
    onParsed({
      validLeads: [],
      invalidLeads: [],
      totalRows: 0,
    });
    setFileName("");

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5 MB.");
      return;
    }

    setLoading(true);

    try {
      const result = await parseLeadCSV(file);

      if (result.totalRows === 0) {
        throw new Error("The CSV file contains no data rows.");
      }

      setFileName(file.name);
      onParsed(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to parse CSV file."
      );
    } finally {
      setLoading(false);
    }
  }

  function clearFile() {
    setFileName("");
    setError("");

    onParsed({
      validLeads: [],
      invalidLeads: [],
      totalRows: 0,
    });

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFile(event.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
          }}
        />

        {loading ? (
          <Loader2 className="mx-auto animate-spin text-indigo-600" size={32} />
        ) : (
          <Upload className="mx-auto text-indigo-600" size={32} />
        )}

        <p className="mt-3 text-sm font-semibold text-slate-800">
          {loading ? "Parsing CSV..." : "Drop your CSV file here"}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          or click to browse · Maximum file size 5 MB
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {fileName && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-green-600" size={22} />
            <span className="text-sm font-medium text-slate-700">
              {fileName}
            </span>
          </div>

          <button
            type="button"
            onClick={clearFile}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Remove CSV file"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
