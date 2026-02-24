import { Router } from "express";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { storage } from "../storage";

const router = Router();

const BRAND_COLORS = {
  primary: "#0c3367",
  secondary: "#d0bf6d",
  accent: "#1a4a8a",
  text: "#1a1a2e",
  textLight: "#555555",
  border: "#d0bf6d",
  sectionBg: "#f5f3eb",
  success: "#22c55e",
};

function formatDate(dateString: string | Date | null, useUTC = false) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: useUTC ? "UTC" : "America/Sao_Paulo",
  });
}

function formatDateOnly(dateString: string | Date | null) {
  if (!dateString) return "";
  const str = typeof dateString === "string" ? dateString : dateString.toISOString();
  const parts = str.substring(0, 10).split("-");
  if (parts.length !== 3) return "";
  const [year, month, day] = parts;
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  return `${day} de ${months[parseInt(month) - 1]} de ${year}`;
}

function formatCurrency(value: number | string) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return `R$ ${numValue.toFixed(2).replace(".", ",")}`;
}

function formatCPF(cpf: string | null): string {
  if (!cpf) return "N/A";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
}

router.get("/:registrationId", async (req, res) => {
  try {
    const athleteId = (req.session as any)?.athleteId;
    if (!athleteId) {
      return res.status(401).json({ success: false, error: "Não autenticado" });
    }

    const { registrationId } = req.params;
    const registration = await storage.getRegistration(registrationId);

    if (!registration) {
      return res
        .status(404)
        .json({ success: false, error: "Inscrição não encontrada" });
    }

    if (registration.athleteId !== athleteId) {
      return res
        .status(403)
        .json({ success: false, error: "Acesso não autorizado" });
    }

    if (registration.status !== "confirmada") {
      return res.status(400).json({
        success: false,
        error: "Comprovante disponível apenas para inscrições confirmadas",
      });
    }

    const [event, modality, athlete, order, batch] = await Promise.all([
      storage.getEvent(registration.eventId),
      storage.getModality(registration.modalityId),
      storage.getAthlete(registration.athleteId),
      registration.orderId ? storage.getOrder(registration.orderId) : null,
      registration.batchId ? storage.getBatch(registration.batchId) : null,
    ]);

    if (!event || !modality || !athlete) {
      return res
        .status(404)
        .json({ success: false, error: "Dados não encontrados" });
    }

    const qrData = JSON.stringify({
      nome: registration.nomeCompleto || athlete.nome,
      cpf: registration.cpf || athlete.cpf || "",
      n_inscricao: registration.numeroInscricao,
      n_pedido: order?.numeroPedido || "",
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 120,
      margin: 1,
      color: {
        dark: BRAND_COLORS.primary,
        light: "#ffffff",
      },
    });

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Comprovante de Inscrição - ${event.nome}`,
        Author: "Sports&Textil - Inscrições",
        Subject: `Inscrição #${registration.numeroInscricao}`,
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=comprovante-inscricao-${registration.numeroInscricao}.pdf`,
    );

    doc.pipe(res);

    doc.rect(0, 0, 595, 80).fill(BRAND_COLORS.primary);

    doc.rect(0, 80, 595, 5).fill(BRAND_COLORS.secondary);

    doc.save();
    doc
      .fontSize(26)
      .font("Helvetica-Bold")
      .fillColor("#ffffff")
      .text("SPORTS&TEXTIL", 50, 18);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(BRAND_COLORS.secondary)
      .text("Comprovante de Inscrição", 50, 50);
    doc.restore();

    doc
      .rect(50, 95, 495, 42)
      .fill(BRAND_COLORS.primary);

    doc
      .rect(50, 95, 4, 42)
      .fill(BRAND_COLORS.secondary);

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor(BRAND_COLORS.secondary)
      .text("INSCRIÇÃO CONFIRMADA", 64, 101);

    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .fillColor("#ffffff")
      .text(`#${registration.numeroInscricao}`, 64, 116);

    const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(",")[1], "base64");
    doc.image(qrCodeBuffer, 500, 99, { width: 35, height: 35 });

    doc.y = 148;

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor(BRAND_COLORS.primary)
      .text(event.nome, 50, doc.y);

    doc.moveDown(0.2);
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(BRAND_COLORS.textLight)
      .text(`${formatDateOnly(event.dataEvento)} | ${event.cidade} - ${event.estado}`, 50);

    doc.moveDown(0.8);

    const drawSectionHeader = (title: string) => {
      doc
        .rect(50, doc.y, 495, 20)
        .fill(BRAND_COLORS.sectionBg);

      doc
        .rect(50, doc.y, 3, 20)
        .fill(BRAND_COLORS.secondary);

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(BRAND_COLORS.primary)
        .text(title, 60, doc.y + 6);

      doc.y += 24;
    };

    const drawDataRow = (label: string, value: string, isHighlighted = false) => {
      const rowHeight = 15;
      const startY = doc.y;

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor(BRAND_COLORS.textLight)
        .text(label, 60, startY);

      doc
        .fontSize(9)
        .font(isHighlighted ? "Helvetica-Bold" : "Helvetica")
        .fillColor(isHighlighted ? BRAND_COLORS.primary : BRAND_COLORS.text)
        .text(value, 185, startY);

      doc.y = startY + rowHeight;
    };

    drawSectionHeader("MODALIDADE");

    drawDataRow("Modalidade", `${modality.nome} - ${modality.distancia} ${modality.unidadeDistancia}`, true);
    drawDataRow("Horário de Largada", modality.horarioLargada || "A confirmar");
    if (batch) {
      drawDataRow("Lote", batch.nome);
    }
    if (registration.tamanhoCamisa) {
      let camisaValue = registration.tamanhoCamisa;
      const usarGradePorModalidade = event.usarGradePorModalidade || false;
      let shirtSizes;
      if (usarGradePorModalidade) {
        shirtSizes = await storage.getShirtSizesByModality(registration.modalityId);
      } else {
        shirtSizes = await storage.getShirtSizesByEvent(event.id);
      }
      const selectedSize = shirtSizes.find((s) => s.tamanho === registration.tamanhoCamisa);
      if (selectedSize) {
        const ajustePreco = parseFloat(selectedSize.ajustePreco || "0");
        if (ajustePreco !== 0) {
          const ajusteText =
            ajustePreco < 0
              ? `(Desconto: -R$ ${Math.abs(ajustePreco).toFixed(2).replace(".", ",")})`
              : `(Acréscimo: +R$ ${ajustePreco.toFixed(2).replace(".", ",")})`;
          camisaValue = `${registration.tamanhoCamisa} ${ajusteText}`;
        }
      }
      drawDataRow("Tamanho da Camisa", camisaValue);
    }
    if (registration.equipe) {
      drawDataRow("Equipe", registration.equipe);
    }
    drawDataRow("Data da Inscrição", formatDateOnly(registration.dataInscricao));

    doc.moveDown(0.5);

    drawSectionHeader("PARTICIPANTE");

    drawDataRow("Nome Completo", registration.nomeCompleto || athlete.nome, true);
    drawDataRow("CPF", formatCPF(registration.cpf || athlete.cpf));
    drawDataRow("E-mail", athlete.email);
    drawDataRow("Telefone", athlete.telefone || "N/A");
    if (athlete.dataNascimento) {
      drawDataRow("Data de Nascimento", formatDateOnly(athlete.dataNascimento));
    }
    if (athlete.cidade && athlete.estado) {
      drawDataRow("Cidade/Estado", `${athlete.cidade} - ${athlete.estado}`);
    }

    if (order) {
      doc.moveDown(0.5);

      drawSectionHeader("PAGAMENTO");

      const valorUnitario = parseFloat(registration.valorUnitario);
      const taxaComodidade = parseFloat(registration.taxaComodidade);
      const valorDesconto = parseFloat(order.valorDesconto || "0");

      drawDataRow("Número do Pedido", `#${order.numeroPedido}`);
      drawDataRow("Valor da Inscrição", formatCurrency(valorUnitario));

      if (taxaComodidade > 0) {
        drawDataRow("Taxa de Comodidade", formatCurrency(taxaComodidade));
      }

      if (valorDesconto > 0) {
        let descontoLabel = "Desconto";
        if (order.codigoCupom) {
          descontoLabel = `Desconto (Cupom: ${order.codigoCupom})`;
        } else if (order.codigoVoucher) {
          descontoLabel = `Desconto (Voucher: ${order.codigoVoucher})`;
        }
        drawDataRow(descontoLabel, `- ${formatCurrency(valorDesconto)}`);
      }

      const valorFinal = valorUnitario + taxaComodidade - valorDesconto;
      drawDataRow("Valor Total Pago", formatCurrency(valorFinal > 0 ? valorFinal : 0), true);

      if (order.dataPagamento) {
        drawDataRow("Data do Pagamento", formatDate(order.dataPagamento));
      }

      if (order.metodoPagamento) {
        const metodoPagamentoLabel =
          order.metodoPagamento === "pix"
            ? "PIX"
            : order.metodoPagamento === "credit_card"
              ? "Cartão de Crédito"
              : order.metodoPagamento;
        drawDataRow("Método de Pagamento", metodoPagamentoLabel);
      }
    }

    doc.moveDown(0.5);

    const qrBoxY = doc.y;

    doc
      .rect(50, qrBoxY, 495, 155)
      .fill("#faf9f5");

    doc
      .rect(50, qrBoxY, 495, 155)
      .lineWidth(1.5)
      .strokeColor(BRAND_COLORS.secondary)
      .stroke();

    const qrCodeLargeBuffer = Buffer.from(qrCodeDataUrl.split(",")[1], "base64");
    doc.image(qrCodeLargeBuffer, 62, qrBoxY + 8, { width: 140, height: 140 });

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor(BRAND_COLORS.primary)
      .text("QR Code de Verificação", 220, qrBoxY + 45);

    doc
      .rect(220, qrBoxY + 62, 40, 2)
      .fill(BRAND_COLORS.secondary);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(BRAND_COLORS.textLight)
      .text("Apresente este QR code no dia do evento", 220, qrBoxY + 72)
      .text("para agilizar sua identificação.", 220, qrBoxY + 84);

    doc.moveDown(1);

    const footerY = qrBoxY + 165;

    doc
      .rect(0, footerY, 595, 30)
      .fill(BRAND_COLORS.primary);

    doc
      .rect(0, footerY, 595, 2)
      .fill(BRAND_COLORS.secondary);

    doc
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#ffffff")
      .text(
        "Este documento é um comprovante de inscrição gerado eletronicamente pelo sistema Sports&Textil.",
        50, footerY + 8, { align: "center", width: 495 },
      )
      .text(`Documento gerado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        50, footerY + 18, { align: "center", width: 495 },
      );

    doc.end();
  } catch (error) {
    console.error("[receipts] Erro ao gerar comprovante:", error);
    return res
      .status(500)
      .json({ success: false, error: "Erro ao gerar comprovante" });
  }
});

export default router;
