/* eslint-disable i18next/no-literal-string */
/* ^ We're not worried about i18n for this app ^ */

import NewJerseyIcon from '~/nj/svgs/NewJerseyIcon';

/**
 * Component that displays the New Jersey logo next to AI assistant text.
 */
export default function NewJerseyLogo() {
  return (
    <div className="flex items-center gap-3 p-2">
      <NewJerseyIcon height={23} />
      <span className="font-semibold tracking-tight text-[#0C5295]">NJ AI Assistant</span>
    </div>
  );
}
