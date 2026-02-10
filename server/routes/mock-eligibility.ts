import { Router } from "express";
import { readFileSync } from "fs";
import { join } from "path";

const router = Router();

interface MockAthlete {
  cpf: string;
  nome: string;
  apto: boolean;
  categoria: string;
  observacao: string;
}

function loadMockData(): MockAthlete[] {
  try {
    const filePath = join(process.cwd(), "server", "data", "mock-eligibility.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return data.athletes || [];
  } catch (err) {
    console.error("[mock-eligibility] Erro ao carregar dados mock:", err);
    return [];
  }
}

const MOCK_API_KEY = "test-key-2026";

function validateApiKey(req: any): boolean {
  const headerKey = req.headers["x-api-key"];
  const queryKey = req.query.api_key;
  const authHeader = req.headers["authorization"];

  if (headerKey === MOCK_API_KEY) return true;
  if (queryKey === MOCK_API_KEY) return true;
  if (authHeader === `Bearer ${MOCK_API_KEY}`) return true;

  return false;
}

router.get("/pacientes/:cpf", (req, res) => {
  if (!validateApiKey(req)) {
    return res.status(401).json({ error: "API key inválida ou ausente" });
  }

  const cpf = req.params.cpf.replace(/[.\-]/g, "");
  const athletes = loadMockData();
  const athlete = athletes.find((a) => a.cpf === cpf);

  if (!athlete) {
    return res.status(404).json({ error: "CPF não encontrado na base de dados" });
  }

  return res.json({
    cpf: athlete.cpf,
    nome: athlete.nome,
    apto: athlete.apto,
    categoria: athlete.categoria,
    observacao: athlete.observacao,
  });
});

router.post("/validar", (req, res) => {
  if (!validateApiKey(req)) {
    return res.status(401).json({ error: "API key inválida ou ausente" });
  }

  const { cpf } = req.body || {};
  if (!cpf) {
    return res.status(400).json({ error: "CPF é obrigatório" });
  }

  const cleanCpf = cpf.replace(/[.\-]/g, "");
  const athletes = loadMockData();
  const athlete = athletes.find((a) => a.cpf === cleanCpf);

  if (!athlete) {
    return res.status(404).json({ error: "CPF não encontrado na base de dados" });
  }

  return res.json({
    cpf: athlete.cpf,
    nome: athlete.nome,
    apto: athlete.apto,
    categoria: athlete.categoria,
    observacao: athlete.observacao,
  });
});

export default router;
