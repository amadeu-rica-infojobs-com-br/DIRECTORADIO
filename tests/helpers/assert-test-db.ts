export function assertTestDbUrl(url: string | undefined): string {
  if (!url) throw new Error('DATABASE_URL_TEST is not set')
  const name = new URL(url).pathname.replace(/^\//, '')
  if (name !== 'directoradio_test') {
    throw new Error(`Refusing to run against database "${name}": DATABASE_URL_TEST must point to directoradio_test`)
  }
  return url
}
