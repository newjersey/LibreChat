/* eslint-disable i18next/no-literal-string */
/* ^ We're not worried about i18n for this app ^ */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { AnimatePresence, motion } from 'framer-motion';
import { newUpdatesWidgetDismissed } from '~/nj/store/landing';
import icons from '@uswds/uswds/img/sprite.svg';

export default function NewUpdatesWidget() {
  const [dismissed, setDismissed] = useRecoilState(newUpdatesWidgetDismissed);
  const [expanded, setExpanded] = useState(false);

  if (import.meta.env.VITE_DISPLAY_UPDATE_WIDGET !== 'true' || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    setExpanded(false);
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return (
    <div className="fixed right-4 top-2 z-20">
      <AnimatePresence>
        {!expanded ? (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={toggleExpanded}
            className="hover:bg-text-primary/90 flex items-center gap-2 rounded-full bg-text-primary px-4 py-2 text-sm font-medium text-surface-primary shadow-lg"
          >
            <svg
              className="usa-icon usa-icon--size-3"
              aria-hidden="true"
              focusable="false"
              role="img"
            >
              <use href={`${icons}#notifications`} />
            </svg>
            <span>New updates</span>
            <svg
              className="usa-icon usa-icon--size-3"
              aria-hidden="true"
              focusable="false"
              role="img"
            >
              <use href={`${icons}#expand_more`} />
            </svg>
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-80 rounded bg-text-primary p-6 text-surface-primary shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-base font-semibold">New update</h3>
              <button
                onClick={toggleExpanded}
                className="hover:text-surface-primary/80 text-surface-primary"
                aria-label="Close"
              >
                <svg
                  className="usa-icon usa-icon--size-3"
                  aria-hidden="true"
                  focusable="false"
                  role="img"
                >
                  <use href={`${icons}#close`} />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <p className="mb-3 text-sm">
                The new updates widget is live! Here&apos;s a link to the Guide Page to prove
                functionality.
              </p>
              <Link
                to={{ pathname: '/nj/guide' }}
                className="inline-flex items-center gap-1 text-sm underline hover:decoration-2"
              >
                Guide Page
                <svg
                  className="usa-icon usa-icon--size-2"
                  aria-hidden="true"
                  focusable="false"
                  role="img"
                >
                  <use href={`${icons}#arrow_forward`} />
                </svg>
              </Link>
            </div>

            <button
              onClick={handleDismiss}
              className="hover:bg-surface-primary/10 w-full rounded border-2 border-surface-primary bg-transparent py-2 text-sm font-medium text-surface-primary"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
