import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { propostaService } from '../services/propostaService';

export default function PropostaView() {
  console.log('🚀 PropostaView carregada!');
  const { propostaId } = useParams();
  console.log('📋 PropostaId recebido:', propostaId);
  
  const [pdfUrl, setPdfUrl] = useState('');
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (propostaId) {
      loadPdfFromBackend();
    }
  }, [propostaId]);

  const loadPdfFromBackend = async () => {
    setIsLoadingPdf(true);
    setError(null);
    
    try {
      console.log('🔄 Carregando HTML do backend para proposta:', propostaId);
      
      // Buscar HTML diretamente do backend
      const response = await fetch(`http://localhost:8000/gerar-pdf/${propostaId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Proposta não encontrada. O ID "${propostaId}" pode ter sido gerado quando o servidor estava indisponível. Tente gerar uma nova proposta.`);
        }
        throw new Error(`Erro ao carregar proposta: ${response.status}`);
      }
      
      const htmlContent = await response.text();
      console.log('✅ HTML carregado com sucesso');
      
      // Criar um blob URL para o HTML
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      setPdfUrl(url);
      
    } catch (error) {
      console.error('❌ Erro ao carregar proposta:', error);
      setError(error.message);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const downloadPdf = async () => {
    if (!propostaId) return;
    
    try {
      console.log('📥 Baixando HTML da proposta...');
      
      // Buscar HTML diretamente do backend
      const response = await fetch(`http://localhost:8000/gerar-pdf/${propostaId}`);
      
      if (!response.ok) {
        throw new Error(`Erro ao baixar: ${response.status}`);
      }
      
      const htmlContent = await response.text();
      
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
      </div>
    </div>
  );
}
