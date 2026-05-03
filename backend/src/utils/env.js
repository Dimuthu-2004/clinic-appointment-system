const normalizeEnvValue = (value) => {
  const trimmed = String(value || '').trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
};

const isPlaceholderValue = (value, placeholders = []) => {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return !normalized || placeholders.map((item) => String(item).trim().toLowerCase()).includes(normalized);
};

module.exports = {
  normalizeEnvValue,
  isPlaceholderValue,
};
