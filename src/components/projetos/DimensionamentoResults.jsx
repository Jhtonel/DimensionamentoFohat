import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../../components/ui/button';
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { propostaService } from '../../services/propostaService';

export default function DimensionamentoResults({ resultados, formData, onSave, loading, projecoesFinanceiras, kitSelecionado, clientes = [], configs = {}, autoGenerateProposta = false, onAutoGenerateComplete }) {
  const [propostaSalva, setPropostaSalva] = useState(false);
  const [propostaId, setPropostaId] = useState(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [templateContent, setTemplateContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [propostaData, setPropostaData] = useState(null);
  const pdfRef = useRef(null);

  // Função para obter dados seguros com fallbacks
  // Funções auxiliares para calcular valores financeiros
  const calcularContaAtualAnual = useCallback(() => {
    const consumoReais = Number(formData?.consumo_mensal_reais) || 0;
    console.log('💰 DEBUG calcularContaAtualAnual - consumoReais:', consumoReais);
    
    if (consumoReais > 0) {
      const resultado = consumoReais * 12;
      console.log('💰 DEBUG calcularContaAtualAnual - resultado (reais):', resultado);
      return resultado;
    }
    
    // Se não tem consumo em reais, calcular baseado em kWh e tarifa
    const consumoKwh = Number(formData?.consumo_mensal_kwh) || 0;
    const tarifa = Number(formData?.tarifa_energia) || 0.75;
    console.log('💰 DEBUG calcularContaAtualAnual - consumoKwh:', consumoKwh, 'tarifa:', tarifa);
    
    if (consumoKwh > 0) {
      const resultado = consumoKwh * tarifa * 12;
      console.log('💰 DEBUG calcularContaAtualAnual - resultado (kwh):', resultado);
      return resultado;
    }
    
    console.log('💰 DEBUG calcularContaAtualAnual - resultado final: 0');
    return 0;
  }, [formData]);

  const calcularGastoAcumuladoPayback = useCallback(() => {
    const contaAnual = calcularContaAtualAnual();
    const anosPayback = Math.round((projecoesFinanceiras?.payback_meses || 0) / 12);
    console.log('💰 DEBUG calcularGastoAcumuladoPayback - contaAnual:', contaAnual, 'anosPayback:', anosPayback);
    const resultado = contaAnual * anosPayback;
    console.log('💰 DEBUG calcularGastoAcumuladoPayback - resultado:', resultado);
    return resultado;
  }, [calcularContaAtualAnual, projecoesFinanceiras]);

  const getDadosSeguros = useCallback(() => {
    const dadosBase = resultados || {};
    const kit = kitSelecionado || {};
    const projecoes = projecoesFinanceiras || {};

        console.log('🔍 DEBUG getDadosSeguros - dadosBase:', dadosBase);
        console.log('🔍 DEBUG getDadosSeguros - kit:', kit);
        console.log('🔍 DEBUG getDadosSeguros - projecoes:', projecoes);
        console.log('🔍 DEBUG getDadosSeguros - formData:', formData);
        console.log('💰 DEBUG valores de entrada financeiros:', {
          consumo_mensal_reais: formData?.consumo_mensal_reais,
          payback_meses: projecoes?.payback_meses,
          economia_mensal_estimada: projecoes?.economia_mensal_estimada,
          economia_total_25_anos: projecoes?.economia_total_25_anos,
          custo_total_projeto: projecoes?.custo_total_projeto
        });

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

    const dadosSeguros = {
      potencia_sistema_kwp: dadosBase.potencia_sistema_kwp || kit.potencia || 0,
      quantidade_placas: quantidade_placas,
      potencia_placa_w: potencia_placa_w,
      preco_final: dadosBase.preco_venda || kit.precoTotal || 0,
      economia_mensal_estimada: projecoes.economia_mensal_estimada || 0,
      payback_meses: projecoes.payback_meses || 0,
      economia_total_25_anos: projecoes.economia_total_25_anos || 0,
      consumo_mensal_kwh: formData?.consumo_mensal_kwh || 0,
      irradiacao_media: formData?.irradiancia_media || 5.15, // Fallback para irradiância
      geracao_media_mensal: projecoes.geracao_media_mensal || 0,
      creditos_anuais: projecoes.creditos_anuais || 0,
      area_necessaria: Math.round((quantidade_placas || 0) * 2.5) || kit.area || 0, // Usar área do kit se disponível
      custo_total_projeto: projecoes.custo_total_projeto || kit.precoTotal || 0,
      custo_equipamentos: projecoes.custo_equipamentos || 0,
      custo_instalacao: projecoes.custo_instalacao || 0,
      custo_homologacao: projecoes.custo_homologacao || 0,
      custo_outros: projecoes.custo_outros || 0,
      margem_lucro: projecoes.margem_lucro || 0,
      tarifa_energia: formData?.tarifa_energia || (formData?.consumo_mensal_reais / (formData?.consumo_mensal_kwh || 1)) || 0.75,
    // Dados financeiros calculados
    conta_atual_anual: calcularContaAtualAnual(),
    anos_payback: Math.round((projecoes.payback_meses || 0) / 12),
    gasto_acumulado_payback: calcularGastoAcumuladoPayback(),
    };

        console.log('🔍 DEBUG getDadosSeguros - resultado final:', dadosSeguros);
        console.log('💰 DEBUG valores financeiros específicos:', {
          conta_atual_anual: dadosSeguros.conta_atual_anual,
          anos_payback: dadosSeguros.anos_payback,
          gasto_acumulado_payback: dadosSeguros.gasto_acumulado_payback,
          potencia_sistema_kwp: dadosSeguros.potencia_sistema_kwp,
          preco_final: dadosSeguros.preco_final
        });
        return dadosSeguros;
  }, [resultados, formData, projecoesFinanceiras, kitSelecionado, calcularContaAtualAnual, calcularGastoAcumuladoPayback]);

  const dadosSeguros = getDadosSeguros();

  // Função de teste para gerar proposta com valores fixos
  const gerarPropostaTeste = async () => {
    setIsGeneratingPDF(true);

    try {
      console.log('🧪 TESTE: Gerando proposta com dados reais do cliente...');

      const cliente = clientes.find(c => c.id === formData?.cliente_id);
      
      const propostaDataTeste = {
        // Dados do cliente REAL
        cliente_nome: cliente?.nome || 'Cliente Teste',
        cliente_endereco: cliente?.endereco_completo || 'Endereço não informado',
        cliente_telefone: cliente?.telefone || 'Telefone não informado',
        
        // Dados do projeto REAL
        potencia_sistema: dadosSeguros.potencia_sistema_kwp || 1.17,
        preco_final: dadosSeguros.preco_final || 3540.8,
        cidade: formData?.cidade || 'São José dos Campos',
        
        // Dados do vendedor REAL
        vendedor_nome: configs.vendedor_nome || 'Representante Comercial',
        vendedor_cargo: configs.vendedor_cargo || 'Especialista em Energia Solar',
        vendedor_telefone: configs.vendedor_telefone || '(11) 99999-9999',
        vendedor_email: configs.vendedor_email || 'contato@empresa.com',
        
        // Dados financeiros CALCULADOS (não fixos)
        conta_atual_anual: dadosSeguros.conta_atual_anual || 1200,
        anos_payback: dadosSeguros.anos_payback || 3,
        gasto_acumulado_payback: dadosSeguros.gasto_acumulado_payback || 3600,
        consumo_mensal_kwh: formData?.consumo_mensal_kwh || 100,
        tarifa_energia: dadosSeguros.tarifa_energia || 0.75,
        economia_mensal_estimada: dadosSeguros.economia_mensal_estimada || 75,
        
        // Dados do kit REAL
        quantidade_placas: dadosSeguros.quantidade_placas || 3,
        potencia_placa_w: dadosSeguros.potencia_placa_w || 390,
        area_necessaria: dadosSeguros.area_necessaria || 7.5,
        irradiacao_media: dadosSeguros.irradiacao_media || 5.15,
        geracao_media_mensal: dadosSeguros.geracao_media_mensal || 150,
        creditos_anuais: dadosSeguros.creditos_anuais || 1800,
        economia_total_25_anos: dadosSeguros.economia_total_25_anos || 25000,
        payback_meses: dadosSeguros.payback_meses || 36,
        
        // Custos REAIS
        custo_total_projeto: dadosSeguros.custo_total_projeto || 3540.8,
        custo_equipamentos: dadosSeguros.custo_equipamentos || 2500,
        custo_instalacao: dadosSeguros.custo_instalacao || 800,
        custo_homologacao: dadosSeguros.custo_homologacao || 200,
        custo_outros: dadosSeguros.custo_outros || 40.8,
        margem_lucro: dadosSeguros.margem_lucro || 1000
      };

      console.log('🧪 TESTE: Dados da proposta teste (com dados reais):', propostaDataTeste);

      const result = await propostaService.salvarProposta(propostaDataTeste);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      const propostaId = result.proposta_id;
      console.log('🧪 TESTE: Proposta salva com ID:', propostaId);

      const htmlResult = await propostaService.gerarPropostaHTML(propostaId);
      
      if (!htmlResult.success) {
        throw new Error(htmlResult.message);
      }

      console.log('🧪 TESTE: HTML da proposta gerado');

      setPropostaData(propostaDataTeste);
      setPropostaId(propostaId);
      setPropostaSalva(true);
      setShowPreview(true);
      setTemplateContent(htmlResult.html_content);
      
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      alert('Erro no teste: ' + error.message);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // useEffect para auto-geração da proposta
  useEffect(() => {
    if (autoGenerateProposta && formData && !showPreview) {
      console.log('🚀 Auto-geração da proposta ativada!');
      console.log('🔍 Verificando dados disponíveis:', {
        formData: !!formData,
        kitSelecionado: !!kitSelecionado,
        projecoesFinanceiras: !!projecoesFinanceiras,
        dadosSeguros: dadosSeguros
      });
      
      // Aguardar um pouco para garantir que os dados estejam disponíveis
      setTimeout(() => {
        salvarProposta();
      }, 1000);
    }
  }, [autoGenerateProposta, formData, showPreview, kitSelecionado, projecoesFinanceiras]);

  // useEffect para notificar quando a auto-geração for concluída
  useEffect(() => {
    if (showPreview && autoGenerateProposta && onAutoGenerateComplete) {
      console.log('✅ Auto-geração concluída, notificando componente pai');
      onAutoGenerateComplete();
    }
  }, [showPreview, autoGenerateProposta, onAutoGenerateComplete]);

  // Função para converter imagem para base64
  const convertImageToBase64 = async (imagePath) => {
    try {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Erro ao converter imagem para base64:', error);
      return null;
    }
  };

  // Carregar template quando o componente montar (apenas se não foi processado pelo servidor)
  useEffect(() => {
    // Não executar se o template já foi processado pelo servidor Python
    if (templateContent && !templateContent.includes('{{')) {
      console.log('🔄 Template já processado pelo servidor, pulando carregamento local');
      return;
    }
    
    const loadTemplate = async () => {
      try {
        console.log('🔄 Carregando template local (fallback)');
        const response = await fetch('/template.html');
        let templateHtml = await response.text();
        
        // Converter imagens para base64
        const fohatBase64 = await convertImageToBase64('/img/fohat.svg');
        const logoBase64 = await convertImageToBase64('/img/logo.svg');
        const comoFuncionaBase64 = await convertImageToBase64('/img/como-funciona.png');
        
        // Substituir URLs das imagens por base64
        if (fohatBase64) {
          templateHtml = templateHtml.replace(/url\('\/img\/fohat\.svg'\)/g, `url('${fohatBase64}')`);
        }
        if (logoBase64) {
          templateHtml = templateHtml.replace(/src="\/img\/logo\.svg"/g, `src="${logoBase64}"`);
        }
        if (comoFuncionaBase64) {
          templateHtml = templateHtml.replace(/src="\/img\/como-funciona\.png"/g, `src="${comoFuncionaBase64}"`);
        }
        
        // Substituir variáveis básicas (apenas as que não foram processadas pelo servidor)
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
  }, [formData, clientes, dadosSeguros, configs, templateContent]);

  const salvarProposta = async () => {
    setIsGeneratingPDF(true);

    try {
      console.log('🔄 Salvando proposta no servidor...');

      // Preparar dados da proposta para o servidor
      const propostaData = {
        cliente_nome: clientes.find(c => c.id === formData?.cliente_id)?.nome || 'Cliente',
        cliente_endereco: clientes.find(c => c.id === formData?.cliente_id)?.endereco_completo || 'Endereço não informado',
        cliente_telefone: clientes.find(c => c.id === formData?.cliente_id)?.telefone || 'Telefone não informado',
        potencia_sistema: dadosSeguros.potencia_sistema_kwp,
        preco_final: dadosSeguros.preco_final,
        cidade: formData?.cidade || 'Projeto',
        vendedor_nome: configs.vendedor_nome || 'Representante Comercial',
        vendedor_cargo: configs.vendedor_cargo || 'Especialista em Energia Solar',
        vendedor_telefone: configs.vendedor_telefone || '(11) 99999-9999',
        vendedor_email: configs.vendedor_email || 'contato@empresa.com',
        // Dados financeiros
        conta_atual_anual: dadosSeguros.conta_atual_anual || 0,
        anos_payback: dadosSeguros.anos_payback || 0,
        gasto_acumulado_payback: dadosSeguros.gasto_acumulado_payback || 0,
        consumo_mensal_kwh: formData?.consumo_mensal_kwh || 0,
        tarifa_energia: dadosSeguros.tarifa_energia || 0.75,
        economia_mensal_estimada: dadosSeguros.economia_mensal_estimada || 0,
        // Dados do kit
        quantidade_placas: dadosSeguros.quantidade_placas || 0,
        potencia_placa_w: dadosSeguros.potencia_placa_w || 0,
        area_necessaria: dadosSeguros.area_necessaria || 0,
        irradiacao_media: dadosSeguros.irradiacao_media || 5.15,
        geracao_media_mensal: dadosSeguros.geracao_media_mensal || 0,
        creditos_anuais: dadosSeguros.creditos_anuais || 0,
        economia_total_25_anos: dadosSeguros.economia_total_25_anos || 0,
        payback_meses: dadosSeguros.payback_meses || 0,
        // Custos
        custo_total_projeto: dadosSeguros.custo_total_projeto || 0,
        custo_equipamentos: dadosSeguros.custo_equipamentos || 0,
        custo_instalacao: dadosSeguros.custo_instalacao || 0,
        custo_homologacao: dadosSeguros.custo_homologacao || 0,
        custo_outros: dadosSeguros.custo_outros || 0,
        margem_lucro: dadosSeguros.margem_lucro || 0
      };

      console.log('📊 Dados da proposta para o servidor:', propostaData);
      console.log('💰 Valores financeiros específicos sendo enviados:', {
        conta_atual_anual: propostaData.conta_atual_anual,
        anos_payback: propostaData.anos_payback,
        gasto_acumulado_payback: propostaData.gasto_acumulado_payback,
        potencia_sistema: propostaData.potencia_sistema,
        preco_final: propostaData.preco_final
      });
      console.log('🔍 DEBUG dadosSeguros completo:', dadosSeguros);

      // Salvar no servidor
      const result = await propostaService.salvarProposta(propostaData);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      const propostaId = result.proposta_id;
      console.log('✅ Proposta salva no servidor com ID:', propostaId);

      // Gerar HTML da proposta
      const htmlResult = await propostaService.gerarPropostaHTML(propostaId);
      
      if (!htmlResult.success) {
        throw new Error(htmlResult.message);
      }

      console.log('✅ HTML da proposta gerado');

      // Salvar dados para preview
      setPropostaData(propostaData);
      setPropostaId(propostaId);
      setPropostaSalva(true);
      setShowPreview(true);
      setTemplateContent(htmlResult.html_content);
      
    } catch (error) {
      console.error('❌ Erro ao salvar proposta:', error);
      alert('Erro ao salvar proposta: ' + error.message);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Função para carregar template para preview
  const loadTemplateForPreview = async (proposta) => {
    try {
      // Usar o HTML já processado pelo servidor Python (que substitui todas as 109 variáveis)
      // Em vez de fazer substituições locais limitadas
      console.log('🔄 Usando HTML já processado pelo servidor Python');
      
      // O templateContent já foi definido pelo servidor Python com todas as variáveis substituídas
      // Não precisamos fazer substituições locais aqui
      
    } catch (error) {
      console.error('❌ Erro ao carregar template para preview:', error);
    }
  };

  // Função para gerar PDF diretamente
  const gerarPDF = async () => {
    if (!templateContent) {
      alert('Template não carregado. Tente novamente.');
      return;
    }

    setIsGeneratingPDF(true);
    
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Criar elemento temporário para renderizar o template
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = templateContent;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      document.body.appendChild(tempDiv);

      // Processar cada slide
      const slides = tempDiv.querySelectorAll('.page');
      console.log(`📄 Encontrados ${slides.length} slides para processar`);

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        console.log(`🔄 Processando slide ${i + 1}/${slides.length}...`);

        // Aguardar imagens carregarem
        const images = slide.querySelectorAll('img');
        if (images.length > 0) {
          console.log(`🖼️ Aguardando ${images.length} imagens carregarem...`);
          await Promise.all(Array.from(images).map(img => {
            return new Promise(resolve => {
              if (img.complete) {
                resolve();
              } else {
                img.onload = resolve;
                img.onerror = resolve;
              }
            });
          }));
        }

        const canvas = await html2canvas(slide, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: slide.offsetWidth,
          height: slide.offsetHeight
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        // Calcular escala para A4 landscape
        const scaleX = pdfWidth / imgWidth;
        const scaleY = pdfHeight / imgHeight;
        const scale = Math.min(scaleX, scaleY);
        
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        
        const x = (pdfWidth - scaledWidth) / 2;
        const y = (pdfHeight - scaledHeight) / 2;

        if (i > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
        console.log(`✅ Slide ${i + 1} adicionado ao PDF`);
      }

      // Remover elemento temporário
      document.body.removeChild(tempDiv);

      // Baixar PDF
      const fileName = `Proposta_Solar_${propostaData?.potencia_sistema || '0.00'}kWp_${propostaData?.cidade || 'Projeto'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
      pdf.save(fileName);
      
      console.log(`✅ PDF gerado e baixado: ${fileName}`);
      
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
        {!showPreview ? (
          <div className="space-y-4">
            <Button onClick={salvarProposta} disabled={isGeneratingPDF} className="bg-primary hover:bg-primary-dark text-white">
              {isGeneratingPDF ? 'Gerando...' : 'Gerar Proposta'}
            </Button>
            
            <Button 
              onClick={gerarPropostaTeste} 
              disabled={isGeneratingPDF} 
              variant="outline"
              className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300"
            >
              🧪 Teste com Dados Reais
            </Button>
          </div>
        ) : (
            <>
              <Button onClick={gerarPDF} disabled={isGeneratingPDF} className="bg-green-600 hover:bg-green-700 text-white">
                {isGeneratingPDF ? 'Gerando PDF...' : 'Download PDF'}
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Voltar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Preview da proposta */}
      {showPreview && propostaData && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">Proposta gerada com sucesso!</span>
            </div>
            <p className="text-green-700 mt-1">
              ID: {propostaId} | Cliente: {propostaData.cliente_nome} | Potência: {propostaData.potencia_sistema}kWp
            </p>
          </div>
          
          {/* Preview do template */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h3 className="font-semibold text-gray-700">Preview da Proposta</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <div 
                className="template-preview" 
                dangerouslySetInnerHTML={{ __html: templateContent }}
                style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo original quando não há preview */}
      {!showPreview && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-semibold mb-2">Proposta Comercial</h3>
            <p className="text-gray-600 mb-6">Clique em "Gerar Proposta" para criar e visualizar sua proposta comercial personalizada.</p>
            <Button onClick={salvarProposta} disabled={isGeneratingPDF} className="bg-primary hover:bg-primary-dark text-white">
              {isGeneratingPDF ? 'Gerando...' : 'Gerar Proposta'}
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}