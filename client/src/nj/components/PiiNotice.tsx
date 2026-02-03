/* eslint-disable i18next/no-literal-string */
/* ^ We're not worried about i18n for this app ^ */

import { Info } from 'lucide-react';

export default function PiiNotice() {
  return (
    <div className="mb-4 flex justify-center">
      <div className="flex items-center gap-1 text-sm text-text-secondary">
        <Info className="h-4 w-4" />
        <p>
          It is safe to enter personally identifiable information into the NJ AI Assistant.{' '}
          <a
            href="https://innovation.nj.gov/ai-faq-state-employees/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Learn more
          </a>
        </p>
      </div>
    </div>
  );
}
