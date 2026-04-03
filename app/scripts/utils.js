export function parsePath(path) {
  const filename = path.replace(/^.*[\\/]/, '');
  const directory = path.match(/(.*)[/\\]/)?.[1] ?? '';

  return {
    dir: directory,
    out: filename,
  };
}

export const isFirefox = navigator.userAgent.includes('Firefox');
