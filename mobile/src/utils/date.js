export const formatDateTime = (value) => {
  if (!value) {
    return 'Not set';
  }

  return new Date(value).toLocaleString();
};

export const formatDateOnly = (value) => {
  if (!value) {
    return 'Not set';
  }

  const parsedValue = /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())
    ? new Date(`${String(value).trim()}T00:00:00`)
    : new Date(value);

  return parsedValue.toLocaleDateString();
};

export const toDateKey = (value) => {
  if (!value) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
    return String(value).trim();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const formatCurrency = (amount, currency = 'LKR') => {
  const parsedAmount = Number(amount || 0);

  return `${currency} ${parsedAmount.toFixed(2)}`;
};

export const toPickerItems = (items, labelBuilder) =>
  items.map((item) => ({
    label: labelBuilder(item),
    value: item._id,
  }));
