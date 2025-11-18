import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { propostaService } from '../services/propostaService';

export default function PropostaView() {
  console.log('🚀 PropostaView carregada!');
  const { propostaId } = useParams();
  console.log('📋 PropostaId recebido:', propostaId);
  
  const [pdfUrl, setPdfUrl] = useState('');
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);
  const [backendDirectUrl, setBackendDirectUrl] = useState('');

  useEffect(() => {
    if (!propostaId) return;
    if (hasLoadedRef.current) return; // evita dupla execução em StrictMode
    hasLoadedRef.current = true;
      loadPdfFromBackend();
  }, [propostaId]);

  const loadPdfFromBackend = async () => {
    setIsLoadingPdf(true);
    setError(null);
    
    try {
      // Checagem rápida de disponibilidade do backend
      const serverUp = await propostaService.verificarServidor();
      if (!serverUp) {
        throw new Error('Servidor de propostas (porta 8000) indisponível. Inicie o backend e tente novamente.');
        }
      // Carregar diretamente do backend no iframe (evita CORS/timeouts)
      const backendUrl = `${propostaService.getPropostaURL(propostaId)}?t=${Date.now()}`;
      console.log('🔁 Carregando direto do backend no iframe:', backendUrl);
      setBackendDirectUrl(backendUrl);
      setPdfUrl(backendUrl);
      
    } catch (error) {
      console.error('❌ Erro ao carregar proposta:', error);
      setError(error.message || 'Falha ao carregar proposta');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const downloadPdf = async () => {
    if (!propostaId) return;
    
    try {
      console.log('📥 Baixando HTML da proposta via serviço...');
      const result = await propostaService.gerarPropostaHTML(propostaId);
      if (!result?.success) {
        throw new Error(result?.message || 'Falha ao gerar HTML');
      }
      const htmlContent = result.html_content || '';
      
      // Criar blob e fazer download
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Proposta_Solar_${propostaId}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpar URL temporária
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      console.log('✅ Download concluído');
    } catch (error) {
      console.error('❌ Erro ao baixar:', error);
      alert('Erro ao baixar proposta: ' + error.message);
    }
  };

  if (isLoadingPdf) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Gerando PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-2xl mx-auto p-6">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Erro ao carregar proposta</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-yellow-800 mb-2">Possíveis soluções:</h3>
            <ul className="text-sm text-yellow-700 text-left space-y-1">
              <li>• Verifique se o servidor está rodando na porta 8000</li>
              <li>• Tente gerar uma nova proposta</li>
              <li>• Verifique se o ID da proposta está correto</li>
            </ul>
          </div>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={loadPdfFromBackend}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Tentar Novamente
            </button>
            <button
              onClick={() => window.location.href = '/novo-projeto'}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Nova Proposta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Proposta Solar</h1>
          <div className="flex gap-2">
            <button
              onClick={() => loadPdfFromBackend()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              title="Recarregar PDF"
            >
              🔄 Recarregar
            </button>
            <button
              onClick={downloadPdf}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              📥 Baixar PDF
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <iframe
            src={pdfUrl}
            className="w-full border-0"
            style={{ height: 'calc(100vh - 150px)' }}
            title="Preview da Proposta"
          />
        </div>
        <div className="mt-3 text-right">
          <a
            href={backendDirectUrl || '#'}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            Abrir diretamente no servidor (nova aba)
          </a>
        </div>
      </div>
    </div>
  );
}
