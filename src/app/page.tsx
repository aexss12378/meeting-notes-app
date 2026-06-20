"use client";

import { useState } from "react";
import HomePanel from "@/components/HomePanel";
import RecordingsPanel from "@/components/RecordingsPanel";
import Sidebar from "@/components/Sidebar";
import SummaryApiPanel from "@/components/SummaryApiPanel";
import { useMeetingRecorder } from "@/hooks/useMeetingRecorder";
import { useMeetings } from "@/hooks/useMeetings";
import { useSummaryApiSettings } from "@/hooks/useSummaryApiSettings";
import type { ActiveTab, NavItem } from "@/types";

const navItems: NavItem[] = [
  { id: "home", label: "首頁" },
  { id: "recordings", label: "錄音紀錄" },
  { id: "summaryApi", label: "摘要 API" },
  { id: "tags", label: "標籤" },
  { id: "search", label: "搜尋" },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [uiError, setUiError] = useState("");

  const summaryApi = useSummaryApiSettings();
  const meetings = useMeetings({ onError: setUiError });
  const recorder = useMeetingRecorder({
    meetingTitle,
    uiError,
    setUiError,
    summaryApiSettings: summaryApi.settings,
    refreshMeetings: meetings.refreshMeetings,
    loadMeetingResult: meetings.loadMeetingResult,
    selectPendingMeeting: meetings.selectPendingMeeting,
  });

  return (
    <main className="min-h-screen px-4 py-5 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row">
        <Sidebar activeTab={activeTab} items={navItems} onTabChange={setActiveTab} />

        <div className="grid flex-1 content-start gap-4">
          {activeTab === "home" && (
            <HomePanel
              health={meetings.health}
              loadError={meetings.loadError}
              meetings={meetings.meetings}
              selectedMeetingId={meetings.selectedMeetingId}
              isRecording={recorder.isRecording}
              currentJobId={recorder.currentJobId}
              currentMeetingId={recorder.currentMeetingId}
              jobStatus={recorder.jobStatus}
              meetingTitle={meetingTitle}
              uploadPhase={recorder.uploadPhase}
              uiError={recorder.uiError}
              onBootstrap={meetings.bootstrap}
              onLoadMeetingResult={meetings.loadMeetingResult}
              onStartRecording={recorder.startRecording}
              onStopRecording={recorder.stopRecording}
              onTitleChange={setMeetingTitle}
            />
          )}

          {activeTab === "recordings" && (
            <RecordingsPanel
              meetings={meetings.meetings}
              selectedMeeting={meetings.selectedMeeting}
              selectedMeetingId={meetings.selectedMeetingId}
              result={meetings.result}
              onLoadMeetingResult={meetings.loadMeetingResult}
              onPatchTodo={meetings.patchTodo}
            />
          )}

          {activeTab === "summaryApi" && (
            <SummaryApiPanel
              settings={summaryApi.settings}
              onApiUrlChange={summaryApi.setSummaryApiUrl}
              onModelChange={summaryApi.setSummaryModel}
              onApiKeyChange={summaryApi.setSummaryApiKey}
            />
          )}

          {activeTab === "tags" && (
            <section className="card">
              <h1>標籤</h1>
              <p>這個分頁先保留給之後整理會議用。</p>
            </section>
          )}

          {activeTab === "search" && (
            <section className="card">
              <h1>搜尋</h1>
              <p>這個分頁先保留給之後搜尋會議與摘要用。</p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
