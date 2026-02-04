import { Component, type ComponentChildren } from 'preact';
import { ui } from '../i18n/ui';

interface Props {
  children: ComponentChildren;
  fallback?: ComponentChildren;
  lang?: 'de' | 'en';
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
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

      const lang = this.props.lang || 'en';
      const translations = ui[lang];

      return (
        <div style={{
          padding: '2rem',
          margin: '1rem',
          borderRadius: '12px',
          background: 'rgba(255, 0, 0, 0.1)',
          border: '2px solid rgba(255, 0, 0, 0.3)',
          color: '#fff'
        }}>
          <h2 style={{ color: '#ff6b6b', marginBottom: '1rem' }}>
            ⚠️ {translations['error.title']}
          </h2>
          <p style={{ marginBottom: '1rem', opacity: 0.9 }}>
            {translations['error.message']}
          </p>
          {this.state.error && (
            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                {translations['error.details']}
              </summary>
              <pre style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '1rem',
                borderRadius: '8px',
                overflow: 'auto',
                fontSize: '0.85rem'
              }}>
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
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
              {translations['error.retry']}
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
              {translations['error.reload']}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
