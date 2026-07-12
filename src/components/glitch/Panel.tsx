import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode, useState } from 'react';

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
  subtitle?: string;
};

export function Panel({ title, subtitle, children, className = '' }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <section className={`panel ${className}`} data-open={open}>
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="panel-toggle" onClick={() => setOpen(value => !value)} aria-label={`Toggle ${title}`}>
          [-]
        </button>
      </header>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="panel-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
