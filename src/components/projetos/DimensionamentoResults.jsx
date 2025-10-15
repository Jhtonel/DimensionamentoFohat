import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../../components/ui/button';
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function DimensionamentoResults({ resultados, formData, onSave, loading, projecoesFinanceiras, kitSelecionado, clientes = [], configs = {} }) {
  const [propostaGerada, setPropostaGerada] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [templateContent, setTemplateContent] = useState('');
  const pdfRef = useRef(null);

  // Função para obter dados seguros com fallbacks
  const getDadosSeguros = useCallback(() => {
    const dadosBase = resultados || {};
    const kit = kitSelecionado || {};
    const projecoes = projecoesFinanceiras || {};

    // Calcular quantidade de placas e potência da placa
    let quantidade_placas = 0;
    let potencia_placa_w = 0;
    if (kit.composicao && Array.isArray(kit.composicao)) {
      const painel = kit.composicao.find(item => item.tipo === 'painel');
      if (painel) {
        quantidade_placas = painel.quantidade || 0;
        potencia_placa_w = painel.potencia || 0;
      }
    } else if (kit.componentes && Array.isArray(kit.componentes)) {
      const painel = kit.componentes.find(item => item.tipo === 'painel');
      if (painel) {
        quantidade_placas = painel.quantidade || 0;
        potencia_placa_w = painel.potencia || 0;
      }
    }

    return {
      potencia_sistema_kwp: dadosBase.potencia_sistema_kwp || kit.potencia_kwp || 0,
      quantidade_placas: quantidade_placas,
      potencia_placa_w: potencia_placa_w,
      preco_final: dadosBase.preco_venda || 0,
      economia_mensal_estimada: projecoes.economia_mensal_estimada || 0,
      payback_meses: projecoes.payback_meses || 0,
      economia_total_25_anos: projecoes.economia_total_25_anos || 0,
      consumo_mensal_kwh: formData?.consumo_mensal_kwh || 0,
      irradiacao_media: formData?.irradiancia_media || 5.15, // Fallback para irradiância
      geracao_media_mensal: projecoes.geracao_media_mensal || 0,
      creditos_anuais: projecoes.creditos_anuais || 0,
      area_necessaria: Math.round((quantidade_placas || 0) * 2.5) || 0, // Estimativa de 2.5m² por placa
      custo_total_projeto: projecoes.custo_total_projeto || 0,
      custo_equipamentos: projecoes.custo_equipamentos || 0,
      custo_instalacao: projecoes.custo_instalacao || 0,
      custo_homologacao: projecoes.custo_homologacao || 0,
      custo_outros: projecoes.custo_outros || 0,
      margem_lucro: projecoes.margem_lucro || 0,
      tarifa_energia: formData?.tarifa_energia || (formData?.consumo_mensal_reais / (formData?.consumo_mensal_kwh || 1)) || 0.75,
    };
  }, [resultados, formData, projecoesFinanceiras, kitSelecionado]);

  const dadosSeguros = getDadosSeguros();

  // Carregar template quando o componente montar
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const response = await fetch('/template.html');
        let templateHtml = await response.text();
        
        // Substituir variáveis básicas
        const clienteSelecionado = clientes.find(c => c.id === formData?.cliente_id);
        templateHtml = templateHtml.replace(/{{cliente_nome}}/g, clienteSelecionado?.nome || 'Cliente');
        templateHtml = templateHtml.replace(/{{cliente_endereco}}/g, clienteSelecionado?.endereco_completo || 'Endereço não informado');
        templateHtml = templateHtml.replace(/{{cliente_telefone}}/g, clienteSelecionado?.telefone || 'Telefone não informado');
        templateHtml = templateHtml.replace(/{{potencia_sistema_kwp}}/g, dadosSeguros.potencia_sistema_kwp?.toFixed(2) || '0.00');
        templateHtml = templateHtml.replace(/{{preco_final}}/g, dadosSeguros.preco_final?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00');
        templateHtml = templateHtml.replace(/{{vendedor_nome}}/g, configs.vendedor_nome || 'Representante Comercial');
        templateHtml = templateHtml.replace(/{{vendedor_cargo}}/g, configs.vendedor_cargo || 'Especialista em Energia Solar');
        templateHtml = templateHtml.replace(/{{vendedor_telefone}}/g, configs.vendedor_telefone || '(11) 99999-9999');
        templateHtml = templateHtml.replace(/{{vendedor_email}}/g, configs.vendedor_email || 'contato@empresa.com');
        templateHtml = templateHtml.replace(/{{data_proposta}}/g, new Date().toLocaleDateString('pt-BR'));
        
        setTemplateContent(templateHtml);
      } catch (error) {
        console.error('Erro ao carregar template:', error);
        setTemplateContent('<p>Erro ao carregar proposta</p>');
      }
    };
    
    loadTemplate();
  }, [formData, clientes, dadosSeguros, configs]);

  const gerarPDF = async () => {
    if (!pdfRef.current) return;

    setIsGeneratingPDF(true);

    try {
      console.log('🔄 Iniciando geração do PDF...');

      // Capturar o conteúdo que já está sendo exibido na tela
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      console.log('✅ Canvas gerado:', canvas.width, 'x', canvas.height);

      // Criar PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      const nomeArquivo = `Proposta_Solar_${dadosSeguros.potencia_sistema_kwp?.toFixed(2)}kWp_${formData?.cidade || 'Projeto'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;

      pdf.save(nomeArquivo);

      console.log('✅ PDF gerado e baixado com sucesso:', nomeArquivo);
      setPropostaGerada(true);

    } catch (error) {
      console.error('❌ Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF: ' + error.message);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <motion.div
      ref={pdfRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 bg-white p-6"
    >
      {/* Header com botões de ação */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">Proposta Comercial</h1>
        <div className="flex gap-4">
          <Button onClick={gerarPDF} disabled={isGeneratingPDF} className="bg-primary hover:bg-primary-dark text-white">
            {isGeneratingPDF ? 'Gerando PDF...' : 'Download PDF'}
          </Button>
          <Button variant="outline" onClick={() => alert('Funcionalidade de Enviar por E-mail em desenvolvimento.')}>
            Enviar por E-mail
          </Button>
        </div>
      </div>

      {/* Renderiza o conteúdo do template HTML aqui */}
      <div className="template-container" dangerouslySetInnerHTML={{ __html: templateContent }} />
    </motion.div>
  );
}