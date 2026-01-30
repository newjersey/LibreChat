import useAuthRedirect from '~/routes/useAuthRedirect';
import SimpleHeader from '~/nj/components/SimpleHeader';
import { Outlet } from 'react-router-dom';

/**
 * Template for internal information pages.
 */
export default function NewJerseyInfoTemplate() {
  const { isAuthenticated } = useAuthRedirect();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col">
      <SimpleHeader />
      <div className="flex flex-1 flex-col items-center overflow-y-scroll pt-20">
        <div className="w-full md:max-w-[47rem] xl:max-w-[55rem]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
