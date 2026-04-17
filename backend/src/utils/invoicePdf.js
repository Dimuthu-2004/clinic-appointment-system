const escapePdfText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const formatDate = (value) => {
  if (!value) {
    return 'Not set';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-LK', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsedDate);
};

const formatAmount = (amount, currency) => `${String(currency || 'LKR').toUpperCase()} ${Number(amount || 0).toFixed(2)}`;

const buildLine = (label, value) => `${label}: ${value}`;

const buildInvoiceLines = (billing) => [
  buildLine('Amount', formatAmount(billing.amount, billing.currency)),
  buildLine('Payment method', String(billing.paymentMethod || 'Not set').replace(/_/g, ' ')),
  buildLine('Paid at', formatDate(billing.paidAt)),
  buildLine('Patient', `${billing.patient?.firstName || ''} ${billing.patient?.lastName || ''}`.trim()),
  buildLine('Doctor', `Dr ${billing.doctor?.firstName || ''} ${billing.doctor?.lastName || ''}`.trim()),
  buildLine('Appointment date', formatDate(billing.appointment?.appointmentDate)),
  buildLine('Session', billing.appointment?.appointmentSession || 'Not set'),
  buildLine('Token number', billing.appointment?.tokenNumber || 'Not assigned'),
];

const buildInvoicePdfBuffer = (billing) => {
  const lines = buildInvoiceLines(billing);
  const text = (x, y, value, { font = 'F1', size = 11, color = '0.06 0.20 0.24' } = {}) =>
    [
      'BT',
      `${color} rg`,
      `/${font} ${size} Tf`,
      `${x} ${y} Td`,
      `(${escapePdfText(value)}) Tj`,
      'ET',
    ].join('\n');

  const content = [
    'q 0.055 0.455 0.565 rg 0 740 595 102 re f Q',
    'q 0.875 0.965 0.972 rg 36 612 523 86 re f Q',
    'q 0.984 0.706 0.208 rg 36 600 523 5 re f Q',
    'q 0.945 0.980 0.980 rg 36 318 523 214 re f Q',
    text(44, 796, 'Smart Clinic', { font: 'F2', size: 25, color: '1 1 1' }),
    text(44, 770, 'Payment Receipt', { font: 'F1', size: 13, color: '0.86 0.96 0.98' }),
    text(386, 795, 'Thank you for your payment', { font: 'F1', size: 11, color: '0.86 0.96 0.98' }),
    text(56, 672, 'Total Paid', { font: 'F1', size: 12, color: '0.30 0.43 0.47' }),
    text(56, 640, formatAmount(billing.amount, billing.currency), { font: 'F2', size: 28, color: '0.055 0.455 0.565' }),
    text(356, 672, 'Payment Method', { font: 'F1', size: 12, color: '0.30 0.43 0.47' }),
    text(356, 644, String(billing.paymentMethod || 'Not set').replace(/_/g, ' '), { font: 'F2', size: 16, color: '0.06 0.20 0.24' }),
    text(56, 568, 'Payment Details', { font: 'F2', size: 15, color: '0.055 0.455 0.565' }),
    ...lines.slice(1, 3).map((line, index) => text(56, 538 - index * 24, line)),
    text(56, 488, 'Patient and Doctor', { font: 'F2', size: 15, color: '0.055 0.455 0.565' }),
    ...lines.slice(3, 5).map((line, index) => text(56, 458 - index * 24, line)),
    text(56, 398, 'Appointment Details', { font: 'F2', size: 15, color: '0.055 0.455 0.565' }),
    ...lines.slice(5).map((line, index) => text(56, 368 - index * 24, line)),
    'q 0.055 0.455 0.565 rg 36 92 523 1 re f Q',
    text(56, 64, 'Smart Clinic keeps this receipt for your appointment payment records.', {
      font: 'F1',
      size: 10,
      color: '0.30 0.43 0.47',
    }),
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((objectBody, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${objectBody}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
};

module.exports = {
  buildInvoicePdfBuffer,
};
