import { Component, type ComponentChildren } from 'preact';
import type { ErrorInfo } from 'preact/compat';

interface Props {
  children: ComponentChildren;
  fallback?: ComponentChildren;
  /** Wörterbuch der Seite; liefert die error.*-Texte in allen 15 Sprachen. */
  translationData?: Record<string, string>;
}

interface State {
  hasError: boolean;
  error?: unknown;
}

// Notnagel, falls kein Wörterbuch durchgereicht wurde. Vorher standen hier
// Deutsch und Englisch fest verdrahtet, und die Ersatzanzeige wurde mit allen
// 15 Sprachen aufgerufen — bei den übrigen dreizehn war die Tabelle undefined
// und der Zugriff auf t.title warf. Die Anzeige, die einen Absturz auffangen
// sollte, stürzte also selbst ab.
const NOTFALL = {
  'error.title':   'Something went wrong',
  'error.message': 'The component could not be loaded. Please try again.',
  'error.details': 'Show error details',
  'error.retry':   'Try again',
  'error.reload':  'Reload page',
} as const;

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const w = this.props.translationData ?? {};
      const t = (k: keyof typeof NOTFALL) => w[k] || NOTFALL[k];

      return (
        <div
          style={{
            padding: '2rem',
            margin: '1rem',
            borderRadius: '12px',
            background: 'rgba(255, 0, 0, 0.1)',
            border: '2px solid rgba(255, 0, 0, 0.3)',
            color: '#fff'
          }}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <h2 style={{ color: '#ff6b6b', marginBottom: '1rem' }}>
            ⚠️ {t('error.title')}
          </h2>
          <p style={{ marginBottom: '1rem', opacity: 0.9 }}>
            {t('error.message')}
          </p>
          {this.state.error && import.meta.env.DEV && (
            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                {t('error.details')}
              </summary>
              <pre style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '1rem',
                borderRadius: '8px',
                overflow: 'auto',
                fontSize: '0.85rem'
              }}>
                {(this.state.error instanceof Error ? this.state.error.message : String(this.state.error)) ?? 'Unknown error'}
                {'\n\n'}
                {(this.state.error instanceof Error ? this.state.error.stack : undefined) ?? 'No stack available'}
              </pre>
            </details>
          )}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#ffa500',
                border: 'none',
                borderRadius: '8px',
                color: '#000',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t('error.retry')}
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t('error.reload')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
