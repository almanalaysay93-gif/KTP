function isAllowedUrl(raw, origin) {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return false;
    if (
      url.protocol === "data:" ||
      raw === "about:blank" ||
      raw === "about:srcdoc"
    )
      return true;
    if (url.protocol === "blob:")
      return Boolean(origin && url.origin === origin);
    return Boolean(origin && url.origin === origin);
  } catch {
    return false;
  }
}
module.exports = { isAllowedUrl };
