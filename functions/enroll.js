export async function onRequestGet({ request, env, next }) {
  // Serve enroll.html for /enroll (extensionless clean URL)
  const url = new URL(request.url);
  const newUrl = new URL('/enroll.html', url.origin);
  const newRequest = new Request(newUrl.toString(), request);
  return env.ASSETS.fetch(newRequest);
}
