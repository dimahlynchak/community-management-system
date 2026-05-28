import { forwardRef, ReactNode, TextareaHTMLAttributes } from 'react';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
}

const TextArea = forwardRef<HTMLTextAreaElement, Props>(
  ({ label, hint, error, id, className = '', rows = 4, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-slate-700"
          >
            {label}
          </label>
        )}
        <textarea
          id={id}
          ref={ref}
          rows={rows}
          className={[
            'w-full px-3 py-2 text-sm rounded-md border bg-white',
            'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
            'disabled:bg-slate-100 disabled:text-slate-500 resize-y',
            error ? 'border-red-400' : 'border-slate-300',
            className,
          ].join(' ')}
          {...props}
        />
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : hint ? (
          <p className="text-xs text-slate-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);

TextArea.displayName = 'TextArea';

export default TextArea;
