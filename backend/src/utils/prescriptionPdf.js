const escapePdfText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const formatDate = (value) => {
  if (!value) {
    return 'Not linked';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Not linked';
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

const buildMedicationLines = (prescription) =>
  (prescription.medications || []).flatMap((medication, index) => [
    `${index + 1}. ${medication.name || 'Medicine'}`,
    `Dosage: ${medication.dosage || 'Not set'} | Frequency: ${medication.frequency || 'Not set'} | Duration: ${medication.duration || 'Not set'}`,
    `Instructions: ${medication.instructions || 'No extra instructions'}`,
  ]);

const buildPrescriptionPdfBuffer = (prescription) => {
  const lines = [
    `Patient: ${prescription.patient?.firstName || ''} ${prescription.patient?.lastName || ''}`.trim(),
    `Doctor: Dr ${prescription.doctor?.firstName || ''} ${prescription.doctor?.lastName || ''}`.trim(),
    `Appointment: ${formatDate(prescription.appointment?.appointmentDate)}`,
    `Session: ${prescription.appointment?.appointmentSession || 'Not set'}`,
    `Token: ${prescription.appointment?.tokenNumber || 'Not assigned'}`,
    `Status: ${prescription.status || 'active'}`,
    ...buildMedicationLines(prescription),
    `Notes: ${prescription.notes || 'No extra notes'}`,
  ];

  const text = (x, y, value, { font = 'F1', size = 11, color = '0.08 0.20 0.24' } = {}) =>
    ['BT', `${color} rg`, `/${font} ${size} Tf`, `${x} ${y} Td`, `(${escapePdfText(value)}) Tj`, 'ET'].join('\n');

  const content = [
    'q 0.055 0.455 0.565 rg 0 760 595 82 re f Q',
    text(44, 795, 'Smart Clinic', { font: 'F2', size: 24, color: '1 1 1' }),
    text(44, 770, 'Digital Prescription', { font: 'F1', size: 12, color: '0.86 0.96 0.98' }),
    ...lines.map((line, index) =>
      text(48, 720 - index * 22, line, {
        font: index >= 6 ? 'F1' : 'F2',
        size: index >= 6 ? 10 : 11,
        color: index >= 6 ? '0.14 0.20 0.27' : '0.08 0.20 0.24',
      })
    ),
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
  buildPrescriptionPdfBuffer,
};
