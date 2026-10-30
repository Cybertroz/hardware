/**
 * Formatting helpers for Kenyan context (Ksh, Dates, Percentages)
 */

export function formatKsh(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Ksh 0';
  return `Ksh ${Math.round(amount).toLocaleString('en-KE')}`;
}

export function formatKshExact(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Ksh 0.00';
  return `Ksh ${Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

export function formatShortDate(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}
