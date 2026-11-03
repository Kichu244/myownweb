const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')

export function withBasePath(path: string) {
  const suffix = path.replace(/^\/+/, '')
  return suffix ? `${basePath}/${suffix}` : `${basePath}/`
}

export function pageFromPath(path: string) {
  const appPath = path === basePath || path === `${basePath}/`
    ? '/'
    : path.startsWith(`${basePath}/`)
      ? path.slice(basePath.length)
      : path
  return appPath === '/' ? 'home' : appPath.replace(/^\/+|\/+$/g, '')
}
