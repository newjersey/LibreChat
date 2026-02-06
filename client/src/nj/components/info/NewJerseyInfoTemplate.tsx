import useAuthRedirect from '~/routes/useAuthRedirect';
import SimpleHeader from '~/nj/components/SimpleHeader';
import { Outlet } from 'react-router-dom';
import { useGetStartupConfig } from '~/data-provider';
import useGoogleTagManager from '~/nj/hooks/useGoogleTagManager';

// NJ: Tells TypeScript that <feedback-widget> is a valid custom element.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'feedback-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

/**
 * Template for internal information pages.
 */
export default function NewJerseyInfoTemplate() {
  const { isAuthenticated } = useAuthRedirect();
  const { data: startupConfig } = useGetStartupConfig();

  useGoogleTagManager({ startupConfig });

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      <SimpleHeader />
      <div className="flex flex-1 flex-col items-center overflow-y-scroll pt-16">
        <div className="w-full px-4 md:max-w-[47rem] xl:max-w-[55rem]">
          <Outlet />
        </div>
      </div>
      <feedback-widget show-comment-disclaimer="false" skip-email-step="true"></feedback-widget>
    </div>
  );
}
