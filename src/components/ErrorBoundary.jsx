import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Dashboard render failed:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl shadow-sm p-8 text-center">
            <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} />
            </div>
            <h2 className="text-xl font-black text-slate-900">Something went wrong</h2>
            <p className="text-sm text-slate-500 mt-2">
              This section could not render, but your dashboard is still available.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition"
            >
              <RotateCcw size={16} />
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
