import React from 'react';
import i18n from './i18n';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem', fontFamily: 'monospace', backgroundColor: '#0a0a0a',
          height: '100vh', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', gap: '1rem',
        }}>
          <h2 style={{ color: '#fff', fontSize: '1.2rem', margin: 0 }}>{i18n.t('error_boundary.title')}</h2>
          <p style={{ color: '#9ca3af', textAlign: 'center', maxWidth: '320px', margin: 0, lineHeight: 1.5 }}>
            {i18n.t('error_boundary.body')}
          </p>
          <pre style={{ fontSize: '10px', color: '#ef4444', maxWidth: '320px', overflowX: 'auto', margin: 0 }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 2rem', background: '#dc2626', color: '#fff',
              border: 'none', borderRadius: '1rem', fontWeight: 900,
              cursor: 'pointer', letterSpacing: '0.1em', fontSize: '0.75rem',
            }}
          >
            {i18n.t('error_boundary.reload')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
