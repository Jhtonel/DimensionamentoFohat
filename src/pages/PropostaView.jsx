import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function PropostaView() {
  console.log('🚀 PropostaView carregada!');
  const { propostaId } = useParams();
  console.log('📋 PropostaId recebido:', propostaId);
  const [propostaData, setPropostaData] = useState(null);
  const [templateContent, setTemplateContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const pdfRef = useRef(null);

  useEffect(() => {
    console.log('🔄 useEffect executado para propostaId:', propostaId);
    
    // Tentar carregar dados da URL primeiro
    const urlParams = new URLSearchParams(window.location.search);
    const dataFromUrl = urlParams.get('data');
    
    if (dataFromUrl) {
      try {
        const proposta = JSON.parse(decodeURIComponent(dataFromUrl));
        console.log('📊 Dados carregados da URL:', proposta);
        setPropostaData(proposta);
        loadTemplate(proposta);
        return;
      } catch (error) {
        console.error('❌ Erro ao decodificar dados da URL:', error);
      }
    }
    
    // Se não conseguiu carregar da URL, tentar localStorage com retry
    const loadPropostaData = async (retryCount = 0) => {
      try {
        // Carregar dados da proposta do localStorage
        const propostasSalvas = JSON.parse(localStorage.getItem('propostas_salvas') || '[]');
        console.log('📦 Propostas salvas no localStorage:', propostasSalvas);
        
        const proposta = propostasSalvas.find(p => p.id === propostaId);
        console.log('🔍 Proposta encontrada:', proposta);
        
        if (proposta) {
          console.log('📊 Proposta carregada:', proposta);
          setPropostaData(proposta);
          
          // Carregar template e substituir variáveis
          await loadTemplate(proposta);
        } else {
          // Se não encontrou e ainda tem tentativas, aguarda e tenta novamente
          if (retryCount < 5) {
            console.log(`⏳ Proposta não encontrada, tentando novamente em 200ms... (tentativa ${retryCount + 1}/5)`);
            setTimeout(() => loadPropostaData(retryCount + 1), 200);
          } else {
            console.error('❌ Proposta não encontrada após 5 tentativas:', propostaId);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('❌ Erro ao carregar proposta:', error);
        setLoading(false);
      }
    };
    
    loadPropostaData();
  }, [propostaId]);

  const loadTemplate = async (proposta) => {
    console.log('🔄 Iniciando carregamento do template...');
    try {
      const response = await fetch('/template.html');
      console.log('📄 Resposta do template:', response.status);
      let templateHtml = await response.text();
      console.log('📝 Template carregado, tamanho:', templateHtml.length);
      
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
      
      // Substituir variáveis com dados da proposta
      templateHtml = templateHtml.replace(/{{cliente_nome}}/g, proposta.cliente_nome || 'Cliente');
      templateHtml = templateHtml.replace(/{{cliente_endereco}}/g, proposta.cliente_endereco || 'Endereço não informado');
      templateHtml = templateHtml.replace(/{{cliente_telefone}}/g, proposta.cliente_telefone || 'Telefone não informado');
      templateHtml = templateHtml.replace(/{{potencia_sistema_kwp}}/g, proposta.potencia_sistema?.toFixed(2) || '0.00');
      templateHtml = templateHtml.replace(/{{preco_final}}/g, proposta.preco_final?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00');
      templateHtml = templateHtml.replace(/{{vendedor_nome}}/g, proposta.vendedor_nome || 'Representante Comercial');
      templateHtml = templateHtml.replace(/{{vendedor_cargo}}/g, proposta.vendedor_cargo || 'Especialista em Energia Solar');
      templateHtml = templateHtml.replace(/{{vendedor_telefone}}/g, proposta.vendedor_telefone || '(11) 99999-9999');
      templateHtml = templateHtml.replace(/{{vendedor_email}}/g, proposta.vendedor_email || 'contato@empresa.com');
      templateHtml = templateHtml.replace(/{{data_proposta}}/g, proposta.data_proposta || new Date().toLocaleDateString('pt-BR'));
      
      // Substituir variáveis financeiras
      console.log('🔄 Substituindo variáveis financeiras...');
      console.log('💰 conta_atual_anual:', proposta.conta_atual_anual);
      console.log('📅 anos_payback:', proposta.anos_payback);
      console.log('💸 gasto_acumulado_payback:', proposta.gasto_acumulado_payback);
      
      templateHtml = templateHtml.replace(/{{conta_atual_anual}}/g, proposta.conta_atual_anual?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00');
      templateHtml = templateHtml.replace(/{{anos_payback}}/g, proposta.anos_payback?.toString() || '0');
      templateHtml = templateHtml.replace(/{{gasto_acumulado_payback}}/g, proposta.gasto_acumulado_payback?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00');
      templateHtml = templateHtml.replace(/{{consumo_mensal_kwh}}/g, Number(proposta.consumo_mensal_kwh || 0).toFixed(0));
      templateHtml = templateHtml.replace(/{{tarifa_energia}}/g, Number(proposta.tarifa_energia || 0.75).toFixed(3));
      templateHtml = templateHtml.replace(/{{economia_mensal_estimada}}/g, proposta.economia_mensal_estimada?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00');
      
      setTemplateContent(templateHtml);
    } catch (error) {
      console.error('Erro ao carregar template:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const gerarPDF = async () => {
    if (!pdfRef.current) return;

    setIsGeneratingPDF(true);

    try {
      console.log('🔄 Gerando PDF da proposta...');

      // Criar PDF em formato paisagem (landscape) sem margens
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // Obter dimensões da página em paisagem
      const pdfWidth = pdf.internal.pageSize.getWidth(); // 297mm para A4 paisagem
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 210mm para A4 paisagem

      console.log(`📐 Dimensões da página: ${pdfWidth}mm x ${pdfHeight}mm`);

      // Encontrar todos os slides no template renderizado
      const slides = pdfRef.current.querySelectorAll('.page');
      
      console.log(`📄 Encontrados ${slides.length} slides para processar`);

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        
        console.log(`🔄 Processando slide ${i + 1}/${slides.length}...`);

        // Aguardar todas as imagens carregarem antes da captura
        const images = slide.querySelectorAll('img');
        console.log(`🖼️ Aguardando ${images.length} imagens carregarem...`);
        
        // Aguardar imagens <img> carregarem
        for (const img of images) {
          if (!img.complete) {
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve; // Continuar mesmo se der erro
            });
          }
        }
        
        // Aguardar um pouco mais para garantir que backgrounds carregaram
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Capturar cada slide individualmente com configurações otimizadas
        const canvas = await html2canvas(slide, {
          scale: 1, // Usar escala 1 para manter proporções originais
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: slide.offsetWidth,
          height: slide.offsetHeight,
          scrollX: 0,
          scrollY: 0,
          windowWidth: slide.offsetWidth,
          windowHeight: slide.offsetHeight,
          logging: false,
          removeContainer: true,
          // Configurações adicionais para imagens
          imageTimeout: 15000, // 15 segundos para carregar imagens
          onclone: (clonedDoc) => {
            // Forçar carregamento de imagens no documento clonado
            const clonedImages = clonedDoc.querySelectorAll('img');
            clonedImages.forEach(img => {
              if (img.src.startsWith('/')) {
                img.src = window.location.origin + img.src;
              }
            });
          }
        });

        console.log(`✅ Canvas do slide ${i + 1} gerado:`, canvas.width, 'x', canvas.height);

        // Adicionar nova página se não for a primeira
        if (i > 0) {
          pdf.addPage();
        }

        // Converter canvas para dados da imagem
        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // Adicionar imagem diretamente (template já tem dimensões A4 paisagem)
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        console.log(`✅ Slide ${i + 1} adicionado ao PDF`);
      }

      const nomeArquivo = `Proposta_Solar_${propostaData.potencia_sistema?.toFixed(2)}kWp_${propostaData.cidade}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;

      pdf.save(nomeArquivo);

      console.log('✅ PDF gerado e baixado com sucesso:', nomeArquivo);

    } catch (error) {
      console.error('❌ Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF: ' + error.message);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Carregando proposta...</p>
        </div>
      </div>
    );
  }

  if (!propostaData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Proposta não encontrada</h1>
          <p className="text-gray-600">A proposta com ID "{propostaId}" não foi encontrada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header simples e limpo */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Proposta Comercial - {propostaData.cliente_nome}
              </h1>
              <p className="text-sm text-gray-600">
                ID: {propostaData.id} | Criada em: {new Date(propostaData.data_criacao).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={gerarPDF}
                disabled={isGeneratingPDF}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {isGeneratingPDF ? 'Gerando PDF...' : 'Download PDF'}
              </button>
              <button
                onClick={() => window.close()}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo da Proposta - Proporção A4 paisagem */}
      <div className="flex justify-center items-start">
        <div 
          ref={pdfRef}
          className="bg-white overflow-hidden"
          style={{
            width: '100%',
            maxWidth: '1920px',
            aspectRatio: '297/210', // Proporção A4 paisagem
            height: 'calc(100vh - 120px)', // Altura total menos header
            minHeight: '600px'
          }}
          dangerouslySetInnerHTML={{ __html: templateContent }}
        />
      </div>
    </div>
  );
}
