import { useTranslation } from 'react-i18next';
import { ScrollFade } from './ScrollFade';

// options: strings, or { value, label, hint } (label shown, value passed to onPick), or { heading }
// to start a titled section.
const asOption = (opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt);

export function WizardMenu({
  title,
  options,
  onPick,
  onBack,
  onSkip,
  skipLabel,
  multiSelect = false,
  selectedOptions = [],
  onToggleOption,
  onConfirmSelection,
  confirmLabel = 'Confirm Selection',
  onPrimaryAction,
  primaryActionLabel,
  primaryActionIcon = null,
}) {
  const { t } = useTranslation();
  return (
    <div className="app-page-shell flex flex-col h-full mx-auto animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-8 shrink-0">
        {onBack ? (
          <button
            onClick={onBack}
            className="ui-btn ui-btn--secondary ui-btn--sm"
          >
            ← {t('common.back')}
          </button>
        ) : <div className="w-10" />}
        <p className="text-center font-black uppercase text-[11px] tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>{title}</p>
        <div className="w-10" />
      </div>

      <ScrollFade className="pr-2 pb-10">
        <div className="app-choice-grid">
        {options.map(asOption).map((opt, index) => (opt.heading ? (
          <p key={`heading-${index}`} className="text-[10px] font-black uppercase tracking-widest mt-2" style={{ color: 'var(--text-dim)', gridColumn: '1 / -1' }}>
            {opt.heading}
          </p>
        ) : (
          <button
            key={opt.value}
            onClick={() => (multiSelect ? onToggleOption?.(opt.value) : onPick?.(opt.value))}
            className="app-action-tile border-[2px] text-sm font-black uppercase tracking-widest active:scale-[0.97] transition-all shadow-lg"
            style={multiSelect && selectedOptions.includes(opt.value)
              ? { backgroundColor: 'var(--action-blue)', color: '#fff', border: '2px solid var(--action-blue-border)' }
              : { backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', border: '2px solid var(--border)' }}
          >
            <span className="flex items-center justify-between gap-4 flex-wrap">
              <span className="app-chip-text flex-1 min-w-[7rem]">
                {opt.label}
                {opt.hint && <span className="block mt-1 text-[10px] font-bold normal-case tracking-normal" style={{ color: 'var(--text-dim)' }}>{opt.hint}</span>}
              </span>
              {multiSelect && (
                <span className="text-xs shrink-0" style={{ color: selectedOptions.includes(opt.value) ? '#fff' : 'var(--text-secondary)' }}>
                  {selectedOptions.includes(opt.value) ? t('wizard.selected') : t('wizard.tap_to_add')}
                </span>
              )}
            </span>
          </button>
        )))}
        </div>
        {multiSelect && onConfirmSelection && (
          <button
            onClick={onConfirmSelection}
            disabled={selectedOptions.length === 0}
            className="ui-btn ui-btn--success ui-btn--lg ui-btn--full mt-4"
          >
            {confirmLabel}
          </button>
        )}
        {onPrimaryAction && primaryActionLabel && (
          <button
            onClick={onPrimaryAction}
            className="ui-btn ui-btn--primary ui-btn--lg ui-btn--full mt-4"
          >
            {primaryActionIcon}
            <span className="app-chip-text">{primaryActionLabel}</span>
          </button>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            className="ui-btn ui-btn--warning ui-btn--lg ui-btn--full mt-4"
          >
            {skipLabel}
          </button>
        )}
      </ScrollFade>
    </div>
  );
}
