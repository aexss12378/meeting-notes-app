"use client";

import { useEffect, useState } from "react";
import type { SummaryApiSettings } from "@/types";

const STORAGE_KEYS = {
  apiUrl: "meeting-notes-summary-api-url",
  model: "meeting-notes-summary-model",
  apiKey: "meeting-notes-summary-api-key",
};

export function useSummaryApiSettings() {
  const [summaryApiUrl, setSummaryApiUrl] = useState("");
  const [summaryModel, setSummaryModel] = useState("qwen3:14b");
  const [summaryApiKey, setSummaryApiKey] = useState("");

  useEffect(() => {
    const savedApiUrl = window.localStorage.getItem(STORAGE_KEYS.apiUrl);
    const savedModel = window.localStorage.getItem(STORAGE_KEYS.model);
    const savedApiKey = window.localStorage.getItem(STORAGE_KEYS.apiKey);
    if (savedApiUrl) setSummaryApiUrl(savedApiUrl);
    if (savedModel) setSummaryModel(savedModel);
    if (savedApiKey) setSummaryApiKey(savedApiKey);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.apiUrl, summaryApiUrl);
  }, [summaryApiUrl]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.model, summaryModel);
  }, [summaryModel]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.apiKey, summaryApiKey);
  }, [summaryApiKey]);

  const settings: SummaryApiSettings = {
    apiUrl: summaryApiUrl,
    model: summaryModel,
    apiKey: summaryApiKey,
  };

  return {
    settings,
    setSummaryApiUrl,
    setSummaryModel,
    setSummaryApiKey,
  };
}
