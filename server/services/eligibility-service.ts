import type { EligibilityRule } from '../../shared/schema';

export interface AthleteData {
  cpf: string;
  nome: string;
  email?: string;
  dataNascimento?: string;
  sexo?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  messages: string[];
}

export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length < 11) return '***.***.***-**';
  return `${digits.slice(0, 3)}.***.***.${digits.slice(9, 11)}`;
}

export function sanitizeUrl(baseUrl: string, params: Record<string, string>): string {
  let url = baseUrl;
  for (const [key, value] of Object.entries(params)) {
    const sanitizedValue = key === 'cpf' ? value.replace(/[.\-]/g, '') : value;
    url = url.replace(`{${key}}`, encodeURIComponent(sanitizedValue));
  }
  return url;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current !== undefined && current !== null ? current[key] : undefined;
  }, obj);
}

export async function validateExternalApi(
  ruleConfig: EligibilityRule,
  athleteData: AthleteData
): Promise<{ ok: boolean; message?: string }> {
  try {
    const paramValues: Record<string, string> = {};
    for (const param of ruleConfig.request.params) {
      const value = (athleteData as any)[param];
      if (value !== undefined && value !== null) {
        paramValues[param] = String(value);
      }
    }

    const finalUrl = sanitizeUrl(ruleConfig.request.url, paramValues);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ruleConfig.request.timeout_ms || 3000);

    const fetchOptions: RequestInit = {
      method: ruleConfig.request.method || 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(ruleConfig.request.headers || {}),
      },
    };

    let response: Response;
    try {
      response = await fetch(finalUrl, fetchOptions);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const isTimeout = fetchError.name === 'AbortError';
      const errorType = isTimeout ? 'timeout' : 'network';
      console.error(`[eligibility] Erro de ${errorType} ao validar API externa para CPF ${maskCpf(athleteData.cpf)}`);

      if (ruleConfig.on_error === 'allow') {
        return { ok: true, message: 'Validação externa temporariamente indisponível, inscrição permitida.' };
      }
      return { ok: false, message: ruleConfig.error_message || 'Erro inesperado na validação externa.' };
    }

    clearTimeout(timeoutId);

    if (response.status === 404) {
      console.log(`[eligibility] CPF ${maskCpf(athleteData.cpf)} não encontrado na API externa (404)`);
      return { ok: false, message: ruleConfig.error_message };
    }

    if (response.status >= 500) {
      console.error(`[eligibility] API externa retornou ${response.status} para CPF ${maskCpf(athleteData.cpf)}`);
      if (ruleConfig.on_error === 'allow') {
        return { ok: true, message: 'Validação externa temporariamente indisponível, inscrição permitida.' };
      }
      return { ok: false, message: ruleConfig.error_message || 'Erro inesperado na validação externa.' };
    }

    if (ruleConfig.validation.mode === 'http_status') {
      const allowedStatuses = ruleConfig.validation.allowed_status || [200];
      if (allowedStatuses.includes(response.status)) {
        console.log(`[eligibility] CPF ${maskCpf(athleteData.cpf)} elegível (status ${response.status})`);
        return { ok: true };
      }
      console.log(`[eligibility] CPF ${maskCpf(athleteData.cpf)} inelegível (status ${response.status} não está em [${allowedStatuses.join(',')}])`);
      return { ok: false, message: ruleConfig.error_message };
    }

    if (ruleConfig.validation.mode === 'json_compare') {
      try {
        const data = await response.json();
        const fieldPath = ruleConfig.validation.path || '';
        const expectedValue = ruleConfig.validation.value;
        const actualValue = getNestedValue(data, fieldPath);

        if (actualValue === expectedValue) {
          console.log(`[eligibility] CPF ${maskCpf(athleteData.cpf)} elegível (json_compare: ${fieldPath}=${actualValue})`);
          return { ok: true };
        }
        console.log(`[eligibility] CPF ${maskCpf(athleteData.cpf)} inelegível (json_compare: ${fieldPath}=${actualValue}, esperado=${expectedValue})`);
        return { ok: false, message: ruleConfig.error_message };
      } catch (parseError) {
        console.error(`[eligibility] Erro ao parsear resposta JSON para CPF ${maskCpf(athleteData.cpf)}`);
        if (ruleConfig.on_error === 'allow') {
          return { ok: true, message: 'Validação externa temporariamente indisponível, inscrição permitida.' };
        }
        return { ok: false, message: ruleConfig.error_message || 'Erro inesperado na validação externa.' };
      }
    }

    return { ok: true };
  } catch (error) {
    console.error(`[eligibility] Erro inesperado ao validar CPF ${maskCpf(athleteData.cpf)}:`, error);
    if (ruleConfig.on_error === 'allow') {
      return { ok: true, message: 'Validação externa temporariamente indisponível, inscrição permitida.' };
    }
    return { ok: false, message: ruleConfig.error_message || 'Erro inesperado na validação externa.' };
  }
}

export async function executeEligibilityCheck(
  athleteData: AthleteData,
  rules: EligibilityRule[]
): Promise<EligibilityResult> {
  const activeRules = rules.filter(r => r.enabled && r.request?.url);

  if (activeRules.length === 0) {
    return { eligible: true, messages: [] };
  }

  const messages: string[] = [];
  let eligible = true;

  for (const rule of activeRules) {
    if (rule.type === 'api_rest') {
      const result = await validateExternalApi(rule, athleteData);
      if (!result.ok) {
        eligible = false;
        if (result.message) {
          messages.push(result.message);
        }
      }
    }
  }

  return { eligible, messages };
}
