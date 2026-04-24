"use client";

export default function MeetingList({ meetings, selectedMeetingId, onSelect }) {
  return (
    <div>
      <h2>會議列表</h2>
      <ul className="meeting-list" role="listbox" aria-label="會議列表">
        {meetings.map((meeting) => (
          <li key={meeting.meeting_id}>
            <button
              className={`meeting-item ${selectedMeetingId === meeting.meeting_id ? "active" : ""}`}
              onClick={() => onSelect(meeting.meeting_id)}
              aria-label={`${meeting.title} - ${meeting.status}`}
              role="option"
              aria-selected={selectedMeetingId === meeting.meeting_id}
            >
              <span className="meeting-title">{meeting.title}</span>
              <span className="meeting-meta">{meeting.status}</span>
            </button>
          </li>
        ))}
        {meetings.length === 0 && <li className="hint">目前還沒有會議。</li>}
      </ul>
    </div>
  );
}