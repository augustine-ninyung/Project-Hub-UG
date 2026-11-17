import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';

/** After a new release, old pages may ask for files that no longer exist. */
const isStaleVersion = (error: Error) =>
  /dynamically imported module|Importing a module script failed|Loading chunk|Failed to fetch/i.test(error.message);

/** Tells the admins (by email, through the API) that a page crashed. */
export function reportCrash(error: Error, componentStack?: string | null) {
  if (!import.meta.env.PROD || isStaleVersion(error)) return;
  void api
    .post('/client-errors', {
      message: (error.message || error.name || 'Unknown error').slice(0, 500),
      stack: `${error.stack ?? ''}\n${componentStack ?? ''}`.slice(0, 4000),
      path: window.location.pathname,
    })
    .catch(() => undefined);
}

interface Props {
  children: ReactNode;
  /** Changing it (the page address) clears the error. */
  resetKey: string;
  onError?: (error: Error, componentStack?: string | null) => void;
}

class Boundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    (this.props.onError ?? reportCrash)(error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const stale = isStaleVersion(error);
    return (
      <div role="alert" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-warning/15 text-warning">
          <TriangleAlert className="size-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          {stale ? 'ProjectHub was updated' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {stale
            ? 'A new version is available. Reload the page to continue.'
            : "This page hit a problem. The admins have been told automatically. Reloading usually fixes it; if it doesn't, try again later."}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>
            <RefreshCw /> Reload page
          </Button>
          {!stale && (
            <Button variant="outline" onClick={() => window.location.assign('/')}>
              Go home
            </Button>
          )}
        </div>
      </div>
    );
  }
}

/** Catches crashes anywhere in the pages and shows a friendly screen instead of a blank one. */
export function ErrorBoundary({ children, onError }: Omit<Props, 'resetKey'>) {
  const { pathname } = useLocation();
  return (
    <Boundary resetKey={pathname} onError={onError}>
      {children}
    </Boundary>
  );
}
