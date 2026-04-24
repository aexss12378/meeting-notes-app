"use client";

export default function RecordingControls({
  isRecording,
  currentJobId,
  jobStatus,
  meetingTitle,
  uploadPhase,
  uiError,
  onStart,
  onStop,
  onTitleChange,
}) {
  return (
    <div className="controls">
      <input
        className="title-input"
        placeholder="會議標題，例如：每週產品同步"
        value={meetingTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        disabled={isRecording}
        aria-label="會議標題"
      />

      <div className="row">
        <button
          className="btn btn-primary"
          onClick={onStart}
          disabled={isRecording || !!currentJobId}
          aria-label="開始錄音"
        >
          開始錄音
        </button>
        <button
          className="btn btn-danger"
          onClick={onStop}
          disabled={!isRecording}
          aria-label="停止錄音"
        >
          停止錄音
        </button>
      </div>

      {isRecording && (
        <p className="hint" role="status" aria-live="polite">
          錄音中（麥克風 + 系統音訊）... 停止後會自動上傳並開始處理。
        </p>
      )}
      {uploadPhase && (
        <p className="hint" role="status" aria-live="polite">
          {uploadPhase === "uploading" ? "正在上傳音檔..." : "正在排程處理..."}
        </p>
      )}
      {currentJobId && jobStatus && (
        <p className="hint" role="status" aria-live="polite">
          處理中 ({jobStatus.progress}%): {jobStatus.message || jobStatus.status}
        </p>
      )}
      {uiError && (
        <p className="error" role="alert">
          {uiError}
        </p>
      )}
    </div>
  );
}