import type { TFile } from 'librechat-data-provider';

/**
 * Displays a file in `FilesPanel`.
 */
export default function FileCell({ file }: { file: TFile }) {
  const date = file.createdAt
    ? new Date(file.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="flex gap-3">
      {/* TODO: Dynamic icon based on mimetype */}
      <div className="h-10 w-10 flex-shrink-0 rounded bg-gray-200" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-start text-sm font-medium">{file.filename}</span>
        <span className="text-token-text-secondary text-start text-xs">{date}</span>
      </div>
    </div>
  );
}
