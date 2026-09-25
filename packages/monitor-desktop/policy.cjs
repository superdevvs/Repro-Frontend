const allowedGet =
  /^\/(session|snapshot|settings|traces|services|schedules|incidents(?:\?[^#]*)?|pairing|history\?[^#]*|logs\?[^#]*|ai\/connections|ai\/sessions|ai\/messages(?:\?[^#]*)?)$/;
const allowedPost =
  /^\/(incidents\/[a-f0-9-]{36}|ai\/(chat|connect|disconnect|model)|operator\/link)$/;
function allowed(path, method) {
  return (
    typeof path === "string" &&
    path.length < 2000 &&
    !/[\r\n\x00]/.test(path) &&
    ((method === "GET" && allowedGet.test(path)) ||
      (method === "POST" && allowedPost.test(path)) ||
      (method === "PUT" && path === "/settings"))
  );
}
function notification(incident, previous, now = Date.now()) {
  const version = `${incident.severity}:${incident.state}:${incident.updatedAt}`;
  if (incident.snoozedUntil && Date.parse(incident.snoozedUntil) > now)
    return { notify: false, version: previous };
  return {
    notify:
      previous !== version &&
      incident.state !== "acknowledged" &&
      (incident.state !== "resolved" || !!previous),
    version,
  };
}
module.exports = { allowed, notification };
