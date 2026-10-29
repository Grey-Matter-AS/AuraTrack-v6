// ─── Containers ───────────────────────────────────────────────
export function Section({ title, children, className = '' }) {
  return (
    <section className={`ui-section${className ? ` ${className}` : ''}`}>
      {title && <div className="ui-section__header"><p className="ui-section__title">{title}</p></div>}
      <div className="ui-section__body">{children}</div>
    </section>
  );
}

// tone: danger | accent. compact: tighter padding for row-style cards.
export function Card({ tone, compact = false, as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`ui-card${compact ? ' ui-card--compact' : ''}${tone ? ` ui-card--${tone}` : ''}${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </Tag>
  );
}

export function Inset({ className = '', children, ...rest }) {
  return <div className={`ui-inset${className ? ` ${className}` : ''}`} {...rest}>{children}</div>;
}

export function EmptyState({ children, className = '' }) {
  return <div className={`ui-empty${className ? ` ${className}` : ''}`}>{children}</div>;
}
