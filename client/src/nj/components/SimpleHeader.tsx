import { useOutletContext } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { ContextType } from '~/common';
import NewJerseyLogo from '~/nj/components/NewJerseyLogo';
import { OpenSidebar } from '~/components/Chat/Menus';

/**
 * A version of `Header` that just has the NewJersey logo & sidebar button.
 *
 * (Should just copy `Header`'s source code, minus those components.)
 */
export default function SimpleHeader() {
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();

  return (
    <div className="via-presentation/70 md:from-presentation/80 md:via-presentation/50 2xl:from-presentation/0 absolute top-0 z-10 flex h-14 w-full items-center justify-between bg-gradient-to-b from-presentation to-transparent p-2 font-semibold text-text-primary 2xl:via-transparent">
      <div className="hide-scrollbar flex w-full items-center justify-between gap-2 overflow-x-auto">
        <div className="mx-1 flex items-center">
          <AnimatePresence initial={false}>
            {!navVisible && (
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                key="header-buttons"
              >
                <NewJerseyLogo />
                <OpenSidebar setNavVisible={setNavVisible} className="max-md:hidden" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
