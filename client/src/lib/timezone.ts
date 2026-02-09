import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { isValid, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

function parseLocalDateTimeString(dateString: string): Date | null {
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  
  const [, yearStr, monthStr, dayStr, hourStr = '00', minuteStr = '00', secondStr = '00'] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const second = parseInt(secondStr, 10);
  
  const date = new Date(year, month - 1, day, hour, minute, second);
  return isValid(date) ? date : null;
}

function localStringToUTC(localDateTimeString: string): Date | null {
  const localDate = parseLocalDateTimeString(localDateTimeString);
  if (!localDate) return null;
  return fromZonedTime(localDate, BRAZIL_TIMEZONE);
}

export function formatDateTimeBrazil(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  
  if (typeof dateString === 'string') {
    const localDate = parseLocalDateTimeString(dateString);
    if (!localDate) return '';
    return format(localDate, 'dd/MM/yyyy HH:mm', { locale: ptBR });
  }
  
  if (!isValid(dateString)) return '';
  return formatInTimeZone(dateString, BRAZIL_TIMEZONE, 'dd/MM/yyyy HH:mm', { locale: ptBR });
}

export function formatDateBrazil(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  
  if (typeof dateString === 'string') {
    const localDate = parseLocalDateTimeString(dateString);
    if (!localDate) return '';
    return format(localDate, 'dd/MM/yyyy', { locale: ptBR });
  }
  
  if (!isValid(dateString)) return '';
  return format(dateString, 'dd/MM/yyyy', { locale: ptBR });
}

export function formatDateOnlyBrazil(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  const dateOnly = dateString.split('T')[0];
  const [year, month, day] = dateOnly.split('-').map(Number);
  
  if (!year || !month || !day) return '';
  
  const date = new Date(year, month - 1, day);
  if (!isValid(date)) return '';
  
  return format(date, 'dd/MM/yyyy', { locale: ptBR });
}

export function formatDateOnlyLong(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  const dateOnly = dateString.split('T')[0];
  const [year, month, day] = dateOnly.split('-').map(Number);
  
  if (!year || !month || !day) return '';
  
  const date = new Date(year, month - 1, day);
  if (!isValid(date)) return '';
  
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function formatTimeBrazil(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  
  if (typeof dateString === 'string') {
    const localDate = parseLocalDateTimeString(dateString);
    if (!localDate) return '';
    return format(localDate, 'HH:mm', { locale: ptBR });
  }
  
  if (!isValid(dateString)) return '';
  return formatInTimeZone(dateString, BRAZIL_TIMEZONE, 'HH:mm', { locale: ptBR });
}

export function formatTimestampAsDateBrazil(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  
  if (typeof dateString === 'string') {
    const localDate = parseLocalDateTimeString(dateString);
    if (!localDate) return '';
    return format(localDate, 'dd/MM/yyyy', { locale: ptBR });
  }
  
  if (!isValid(dateString)) return '';
  return formatInTimeZone(dateString, BRAZIL_TIMEZONE, 'dd/MM/yyyy', { locale: ptBR });
}

export function formatForInput(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  
  if (typeof dateString === 'string') {
    const localDate = parseLocalDateTimeString(dateString);
    if (!localDate) return '';
    return format(localDate, "yyyy-MM-dd'T'HH:mm");
  }
  
  if (!isValid(dateString)) return '';
  return formatInTimeZone(dateString, BRAZIL_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

function localStringToUTCDate(dateString: string): Date | null {
  const localDate = parseLocalDateTimeString(dateString);
  if (!localDate) return null;
  return fromZonedTime(localDate, BRAZIL_TIMEZONE);
}

export function isEventOpen(
  aberturaInscricoes: string | Date | null | undefined,
  encerramentoInscricoes: string | Date | null | undefined
): boolean {
  if (!aberturaInscricoes || !encerramentoInscricoes) return false;
  
  const now = new Date();
  
  let aberturaUTC: Date | null;
  let encerramentoUTC: Date | null;
  
  if (typeof aberturaInscricoes === 'string') {
    aberturaUTC = localStringToUTCDate(aberturaInscricoes);
  } else {
    aberturaUTC = aberturaInscricoes;
  }
  
  if (typeof encerramentoInscricoes === 'string') {
    encerramentoUTC = localStringToUTCDate(encerramentoInscricoes);
  } else {
    encerramentoUTC = encerramentoInscricoes;
  }
  
  if (!aberturaUTC || !encerramentoUTC) return false;
  
  return now >= aberturaUTC && now <= encerramentoUTC;
}

export function getEventStatus(
  aberturaInscricoes: string | Date | null | undefined,
  encerramentoInscricoes: string | Date | null | undefined
): 'upcoming' | 'open' | 'closed' {
  if (!aberturaInscricoes || !encerramentoInscricoes) return 'closed';
  
  const now = new Date();
  
  let aberturaUTC: Date | null;
  let encerramentoUTC: Date | null;
  
  if (typeof aberturaInscricoes === 'string') {
    aberturaUTC = localStringToUTCDate(aberturaInscricoes);
  } else {
    aberturaUTC = aberturaInscricoes;
  }
  
  if (typeof encerramentoInscricoes === 'string') {
    encerramentoUTC = localStringToUTCDate(encerramentoInscricoes);
  } else {
    encerramentoUTC = encerramentoInscricoes;
  }
  
  if (!aberturaUTC || !encerramentoUTC) return 'closed';
  
  if (now < aberturaUTC) return 'upcoming';
  if (now > encerramentoUTC) return 'closed';
  return 'open';
}

export function getStatusLabel(status: 'upcoming' | 'open' | 'closed'): string {
  switch (status) {
    case 'upcoming': return 'Em breve';
    case 'open': return 'Inscricoes abertas';
    case 'closed': return 'Inscricoes encerradas';
  }
}

export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return '';
  
  const digits = cpf.replace(/\D/g, '');
  
  if (digits.length !== 11) return cpf;
  
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  
  return phone;
}

export function formatRelativeDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  
  let targetDate: Date | null;
  
  if (typeof dateString === 'string') {
    const localDate = parseLocalDateTimeString(dateString);
    if (!localDate) return '';
    targetDate = fromZonedTime(localDate, BRAZIL_TIMEZONE);
  } else {
    if (!isValid(dateString)) return '';
    targetDate = dateString;
  }
  
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (diff < 0) {
    return 'Encerrado';
  }
  
  if (days > 0) {
    return `${days} dia${days > 1 ? 's' : ''}`;
  }
  
  if (hours > 0) {
    return `${hours} hora${hours > 1 ? 's' : ''}`;
  }
  
  return 'Menos de 1 hora';
}

export function formatCurrency(value: number | string | null | undefined): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numValue);
}
