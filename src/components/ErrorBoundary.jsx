import { Component } from 'react';

// Shows the real error on screen instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[RalhaUltra] Render error:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '40px auto', fontFamily: 'system-ui, sans-serif', color: '#fecaca' }}>
        <h1 style={{ marginTop: 0 }}>Something broke</h1>
        <p>Copy this text and send it to Claude:</p>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#1b0a0a', border: '1px solid #7a1f1f', borderRadius: 12, padding: 16 }}>
          {String(error?.message || error)}
          {'\n\n'}
          {String(error?.stack || '').split('\n').slice(0, 8).join('\n')}
        </pre>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 16px', borderRadius: 10 }}>Reload</button>
      </div>
    );
  }
}
