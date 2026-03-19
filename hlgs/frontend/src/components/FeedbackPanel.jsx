export default function FeedbackPanel({ feedback }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-semibold text-white">Feedback</h3>
      <p className="text-sm text-textMuted">{feedback}</p>
    </div>
  )
}
