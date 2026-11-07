/** Keep the loader in index.html visible across React's startup fallbacks. */
export function AppPreloader() {
  return <span hidden data-app-preloader />;
}
