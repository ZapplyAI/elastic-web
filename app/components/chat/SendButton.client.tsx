import { AnimatePresence, cubicBezier, motion } from 'framer-motion';
import styles from './SendButton.module.scss';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { classNames } from '~/utils/classNames';

interface SendButtonProps {
  show: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onImagesSelected?: (images: File[]) => void;
}

const customEasingFn = cubicBezier(0.4, 0, 0.2, 1);

export const SendButton = ({ show, isStreaming, disabled, onClick }: SendButtonProps) => {
  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          className={styles.sendButton}
          transition={{ ease: customEasingFn, duration: 0.25 }}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();

            if (!disabled) {
              onClick?.(event);
            }
          }}
          aria-label={isStreaming ? 'Stop' : 'Send'}
        >
          <div className={styles.icon}>
            {!isStreaming ? (
              <svg className={styles.arrowIcon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            ) : (
              <svg className={styles.stopIcon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 14H8V8h8v8z" />
              </svg>
            )}
          </div>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
};
