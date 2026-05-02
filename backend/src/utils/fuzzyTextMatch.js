const normalizeSearchText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeSearchText = (value) => normalizeSearchText(value).split(' ').filter(Boolean);

const getEditDistanceThreshold = (length) => {
  if (length <= 2) {
    return 0;
  }

  if (length <= 4) {
    return 1;
  }

  if (length <= 8) {
    return 2;
  }

  return 3;
};

const getLevenshteinDistance = (source, target, maxDistance = Number.POSITIVE_INFINITY) => {
  if (source === target) {
    return 0;
  }

  if (!source.length) {
    return target.length;
  }

  if (!target.length) {
    return source.length;
  }

  if (Math.abs(source.length - target.length) > maxDistance) {
    return maxDistance + 1;
  }

  let previousRow = Array.from({ length: target.length + 1 }, (_, index) => index);

  for (let rowIndex = 0; rowIndex < source.length; rowIndex += 1) {
    const currentRow = [rowIndex + 1];
    let rowMinimum = currentRow[0];

    for (let columnIndex = 0; columnIndex < target.length; columnIndex += 1) {
      const substitutionCost = source[rowIndex] === target[columnIndex] ? 0 : 1;
      const nextValue = Math.min(
        previousRow[columnIndex + 1] + 1,
        currentRow[columnIndex] + 1,
        previousRow[columnIndex] + substitutionCost
      );

      currentRow.push(nextValue);
      rowMinimum = Math.min(rowMinimum, nextValue);
    }

    if (rowMinimum > maxDistance) {
      return maxDistance + 1;
    }

    previousRow = currentRow;
  }

  return previousRow[target.length];
};

const tokenFuzzyMatches = (queryToken, candidateToken) => {
  if (!queryToken || !candidateToken) {
    return false;
  }

  if (queryToken === candidateToken) {
    return true;
  }

  if (queryToken.length >= 4 && (candidateToken.includes(queryToken) || queryToken.includes(candidateToken))) {
    return true;
  }

  const maxLength = Math.max(queryToken.length, candidateToken.length);
  const maxDistance = getEditDistanceThreshold(maxLength);

  if (maxDistance === 0) {
    return false;
  }

  return getLevenshteinDistance(queryToken, candidateToken, maxDistance) <= maxDistance;
};

const textMatchesQuery = (text, normalizedQuery, queryTokens) => {
  const normalizedText = normalizeSearchText(text);

  if (!normalizedText) {
    return false;
  }

  if (normalizedText.includes(normalizedQuery)) {
    return true;
  }

  const textTokens = tokenizeSearchText(normalizedText);

  if (!textTokens.length) {
    return false;
  }

  return queryTokens.every((queryToken) =>
    textTokens.some((textToken) => tokenFuzzyMatches(queryToken, textToken))
  );
};

const hasFuzzyTextMatch = ({ query, texts = [] }) => {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return false;
  }

  const queryTokens = tokenizeSearchText(normalizedQuery);

  return texts.some((text) => textMatchesQuery(text, normalizedQuery, queryTokens));
};

module.exports = {
  hasFuzzyTextMatch,
  normalizeSearchText,
};
