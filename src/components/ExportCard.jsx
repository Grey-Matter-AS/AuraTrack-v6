import { Button, ButtonRow, Card } from './ui';

export function ExportCard({ label, description, icon = null, onExport, actions = null }) {
  return (
    <Card className="w-full !p-5 text-left shadow-lg">
      <div className="flex items-start gap-3">
        {icon && (
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--accent)', border: '1px solid var(--border)' }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-black uppercase tracking-widest text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
          <p className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>{description}</p>
        </div>
      </div>
      {actions ? (
        <ButtonRow className="mt-4">
          {actions.map(action => (
            <Button key={action.label} variant={action.variant === 'secondary' ? 'secondary' : 'primary'} size="sm" icon={action.icon} onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        </ButtonRow>
      ) : (
        <Button variant="primary" size="sm" className="mt-4" onClick={onExport}>Export</Button>
      )}
    </Card>
  );
}
