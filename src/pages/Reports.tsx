import { loadEvents, loadFields } from '@/lib/localStore';
import { getStatus } from '@/lib/status';
import { exportCSV, exportGeoJSON, exportJSON } from '@/lib/export';
import { daysBetween, fmtDate, todayStr } from '@/lib/utils';

async function downloadReport() {
  const { jsPDF } = await import('jspdf');
  const fields = loadFields();
  const events = loadEvents().sort((a, b) => a.startDate.localeCompare(b.startDate));
  const document = new jsPDF({ orientation: 'landscape' });
  const pageHeight = document.internal.pageSize.getHeight();
  const pageWidth = document.internal.pageSize.getWidth();
  const margin = 12;
  const right = pageWidth - margin;
  let y = 16;

  function ensureRoom(height: number) {
    if (y + height > pageHeight - 12) {
      document.addPage();
      y = 16;
    }
  }

  function section(title: string) {
    ensureRoom(12);
    document.setFont('helvetica', 'bold');
    document.setFontSize(12);
    document.setTextColor(45, 106, 79);
    document.text(title, margin, y);
    y += 7;
  }

  document.setFillColor(45, 106, 79);
  document.rect(0, 0, pageWidth, 20, 'F');
  document.setTextColor(255, 255, 255);
  document.setFont('helvetica', 'bold');
  document.setFontSize(15);
  document.text('GrazingTrack - Farm Report', margin, 13);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.text(`Generated ${new Date().toLocaleDateString()}`, right, 13, { align: 'right' });
  y = 29;

  section('1. Farm summary');
  document.setTextColor(70, 70, 70);
  document.setFontSize(8);
  document.text(`${fields.length} fields · ${fields.reduce((sum, field) => sum + field.areaHa, 0).toFixed(1)} ha total · ${events.length} grazing events`, margin, y);
  y += 7;
  fields.forEach((field) => {
    ensureRoom(7);
    const days = events.filter((event) => event.fieldId === field.id).reduce((sum, event) => sum + daysBetween(event.startDate, event.endDate), 0);
    document.setFontSize(8);
    document.setTextColor(35, 35, 35);
    document.text(field.name.slice(0, 45), margin, y);
    document.text(`${field.areaHa.toFixed(1)} ha`, margin + 90, y);
    document.text(getStatus(field).label, margin + 120, y);
    document.text(`${days} grazing days`, margin + 175, y);
    y += 6;
  });

  section('2. Monthly grazing days per field');
  fields.forEach((field) => {
    const history = events.filter((event) => event.fieldId === field.id);
    if (!history.length) return;
    const monthly = new Map<string, number>();
    history.forEach((event) => {
      const start = new Date(`${event.startDate}T00:00:00Z`);
      const end = new Date(`${event.endDate}T00:00:00Z`);
      for (const day = new Date(start); day < end; day.setUTCDate(day.getUTCDate() + 1)) {
        const key = day.toISOString().slice(0, 7);
        monthly.set(key, (monthly.get(key) ?? 0) + 1);
      }
    });
    const keys = [...monthly.keys()].sort();
    ensureRoom(8);
    document.setFont('helvetica', 'bold');
    document.setFontSize(8);
    document.setTextColor(45, 106, 79);
    document.text(field.name.slice(0, 50), margin, y);
    y += 5;
    keys.forEach((key, index) => {
      ensureRoom(6);
      const current = monthly.get(key) ?? 0;
      const previous = index ? monthly.get(keys[index - 1]) : undefined;
      const trend = previous === undefined ? '' : current > previous ? ` (+${current - previous})` : current < previous ? ` (${current - previous})` : ' (=)';
      document.setFont('helvetica', 'normal');
      document.setTextColor(50, 50, 50);
      document.text(`${key}   ${current} days${trend}`, margin + 3, y);
      y += 5;
    });
    y += 2;
  });

  section('3. Full grazing event log');
  events.forEach((event) => {
    ensureRoom(7);
    const field = fields.find((item) => item.id === event.fieldId);
    document.setFontSize(7.5);
    document.setTextColor(45, 45, 45);
    document.text((field?.name ?? 'Unknown field').slice(0, 38), margin, y);
    document.text(`${fmtDate(event.startDate)} - ${fmtDate(event.endDate)}`, margin + 65, y);
    document.text(`${daysBetween(event.startDate, event.endDate)} days`, margin + 112, y);
    document.text(`${event.animalCount} ${event.animalType}`.slice(0, 32), margin + 145, y);
    document.text((event.notes || '').slice(0, 55), margin + 190, y);
    y += 6;
  });

  document.save(`grazingtrack-report-${todayStr()}.pdf`);
}

export default function Reports() {
  const hasRecords = loadFields().length > 0 || loadEvents().length > 0;

  return (
    <div className="sv reports-view">
      <header className="analytics-header">
        <div className="analytics-eyebrow">FARM RECORDS</div>
        <h1>Reports &amp; exports</h1>
        <p>Generate a printable farm report or export your records in open formats.</p>
      </header>
      <section className="card report-section">
        <div>
          <h2 className="card-title">PDF farm report</h2>
          <p>Farm summary, monthly grazing days by field, and the complete event log.</p>
        </div>
        <button className="report-primary" onClick={downloadReport}>↓ Download PDF report</button>
        {!hasRecords && <small>The report will include a summary with no records until you add fields or events.</small>}
      </section>
      <section className="card report-section">
        <div>
          <h2 className="card-title">Data export</h2>
          <p>Keep a backup or open your farm data in mapping and spreadsheet tools.</p>
        </div>
        <div className="report-export-actions">
          <button className="report-export" onClick={exportJSON}>↓ JSON backup</button>
          <button className="report-export" onClick={exportGeoJSON}>↓ GeoJSON fields</button>
          <button className="report-export" onClick={exportCSV}>↓ Events CSV</button>
        </div>
        <div className="report-formats">
          <span><strong>GeoJSON</strong> opens field boundaries in GIS tools.</span>
          <span><strong>CSV</strong> opens grazing history in spreadsheets.</span>
          <span><strong>JSON</strong> includes fields, events, and animal groups.</span>
        </div>
      </section>
    </div>
  );
}