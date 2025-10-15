import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Função para gerar arquivo Excel com dados calculados
export const gerarExcelProposta = (dadosProjeto, projecoesFinanceiras) => {
  console.log('📊 Gerando Excel com dados do projeto:', dadosProjeto);
  console.log('📊 Projeções financeiras:', projecoesFinanceiras);

  // Criar workbook
  const workbook = XLSX.utils.book_new();

  // === ABA VARIÁVEIS ===
  const variaveisData = [
    // Linha 1 - Cabeçalhos
    ['Data', 'Representante', 'Cargo', 'Cliente', 'Tipo Projeto', 'Módulos', 'Qtd Módulos', 'Inversor', 'Qtd Inversor', 'Potência', 'Geração Média', 'Área'],
    // Linha 2 - Dados
    [
      new Date().toLocaleDateString('pt-BR'), // Data
      'Representante', // Representante (será preenchido depois)
      'Vendedor', // Cargo (será preenchido depois)
      dadosProjeto.cliente || 'Cliente', // Cliente
      'Residencial', // Tipo projeto
      dadosProjeto.modulos || 'Painel Solar', // Módulos
      dadosProjeto.quantidadePaineis || 0, // Qtd módulos
      dadosProjeto.inversor || 'Inversor', // Inversor
      dadosProjeto.quantidadeInversores || 0, // Qtd inversor
      dadosProjeto.potenciaKw || 0, // Potência
      dadosProjeto.geracaoMedia || 0, // Geração média
      dadosProjeto.area || 0 // Área
    ]
  ];

  // Adicionar mais colunas para todas as variáveis necessárias
  const variaveisExtras = [
    'Consumo/Geração', 'Fluxo Projetado', 'Payback', 'Com Energia Solar', 'Texto Análise Fin', 'Produção Mensal',
    'Produção x Cons Med', 'Saldo Anual R$', 'Valor Total', 'Parcelas', 'À Vista', 'Cenário Atual',
    'Por Que Aumenta', 'Economia 5 Anos', 'Economia 10 Anos', 'Economia 25 Anos', 'Gasto 5 Anos',
    'Gasto 10 Anos', 'Gasto 25 Anos', 'Endereço Cliente', 'Telefone Cliente'
  ];

  // Adicionar cabeçalhos extras
  variaveisData[0].push(...variaveisExtras);
  
  // Adicionar dados extras
  const dadosExtras = [
    dadosProjeto.consumoGeracao || 0, // Consumo/Geração
    dadosProjeto.fluxoProjetado || 0, // Fluxo Projetado
    projecoesFinanceiras?.payback || 0, // Payback
    'Com energia solar você economiza significativamente na conta de luz', // Com Energia Solar
    'Análise financeira positiva com retorno em ' + (projecoesFinanceiras?.payback || 0) + ' anos', // Texto Análise Fin
    'Produção mensal média de ' + (dadosProjeto.geracaoMedia || 0) + ' kWh', // Produção Mensal
    'Produção superior ao consumo médio', // Produção x Cons Med
    projecoesFinanceiras?.economiaAcumulada?.[24] || 0, // Saldo Anual R$
    dadosProjeto.valorTotal || 0, // Valor Total
    '12x sem juros', // Parcelas
    dadosProjeto.valorAVista || 0, // À Vista
    'Sem energia solar você continuará pagando contas altas', // Cenário Atual
    'A energia elétrica aumenta em média 0.34% ao ano', // Por Que Aumenta
    projecoesFinanceiras?.economiaAcumulada?.[4] || 0, // Economia 5 Anos
    projecoesFinanceiras?.economiaAcumulada?.[9] || 0, // Economia 10 Anos
    projecoesFinanceiras?.economiaAcumulada?.[24] || 0, // Economia 25 Anos
    projecoesFinanceiras?.contaAnual?.[4] * 5 || 0, // Gasto 5 Anos
    projecoesFinanceiras?.contaAnual?.[9] * 10 || 0, // Gasto 10 Anos
    projecoesFinanceiras?.contaAnual?.[24] * 25 || 0, // Gasto 25 Anos
    dadosProjeto.enderecoCliente || 'Endereço não informado', // Endereço Cliente
    dadosProjeto.telefoneCliente || 'Telefone não informado' // Telefone Cliente
  ];

  variaveisData[1].push(...dadosExtras);

  // Adicionar parcelas de 1x até 18x
  for (let i = 1; i <= 18; i++) {
    variaveisData[0].push(`Parcela ${i}x`);
    variaveisData[1].push(dadosProjeto.valorTotal ? (dadosProjeto.valorTotal / i).toFixed(2) : 0);
  }

  // Adicionar financiamentos
  const financiamentos = ['fin12', 'fin24', 'fin36', 'fin48', 'fin60', 'fin72', 'fin84', 'fin96'];
  financiamentos.forEach(fin => {
    variaveisData[0].push(fin);
    variaveisData[1].push(dadosProjeto.valorTotal ? (dadosProjeto.valorTotal * 1.1).toFixed(2) : 0); // 10% de juros
  });

  // Adicionar valores totais e à vista
  variaveisData[0].push('Valor Total 1', 'À Vista 1', 'Valor Total 3', 'À Vista 3', 'Créditos', 'Créditos 1', 'Créditos 3');
  variaveisData[1].push(
    dadosProjeto.valorTotal || 0,
    dadosProjeto.valorAVista || 0,
    dadosProjeto.valorTotal || 0,
    dadosProjeto.valorAVista || 0,
    'R$100', // Créditos
    'R$100', // Créditos 1
    'R$100'  // Créditos 3
  );

  const variaveisSheet = XLSX.utils.aoa_to_sheet(variaveisData);
  XLSX.utils.book_append_sheet(workbook, variaveisSheet, 'Variáveis');

  // === ABA TABELAS GRÁFICOS PROPOSTA ===
  const graficosData = [];

  // Cabeçalhos
  graficosData.push(['Anos', 'Custo Acumulado', 'Conta Mensal', 'Produção Mensal', 'Consumo Mensal', 'Fluxo Positivo', 'Fluxo Negativo', 'Economia', 'Custos']);

  // Dados para 25 anos
  for (let ano = 1; ano <= 25; ano++) {
    const indiceAno = ano - 1;
    graficosData.push([
      ano,
      projecoesFinanceiras?.contaAnual?.[indiceAno] || 0, // Custo Acumulado
      projecoesFinanceiras?.contaMensal?.[indiceAno] || 0, // Conta Mensal
      projecoesFinanceiras?.geracaoMensal?.[indiceAno] || 0, // Produção Mensal
      projecoesFinanceiras?.consumoMensal?.[indiceAno] || 0, // Consumo Mensal
      projecoesFinanceiras?.fluxoCaixaAcumulado?.[indiceAno] > 0 ? projecoesFinanceiras?.fluxoCaixaAcumulado?.[indiceAno] : 0, // Fluxo Positivo
      projecoesFinanceiras?.fluxoCaixaAcumulado?.[indiceAno] < 0 ? Math.abs(projecoesFinanceiras?.fluxoCaixaAcumulado?.[indiceAno]) : 0, // Fluxo Negativo
      projecoesFinanceiras?.economiaAnual?.[indiceAno] || 0, // Economia
      projecoesFinanceiras?.contaAnual?.[indiceAno] || 0 // Custos
    ]);
  }

  const graficosSheet = XLSX.utils.aoa_to_sheet(graficosData);
  XLSX.utils.book_append_sheet(workbook, graficosSheet, 'Tabelas Graficos Proposta');

  // Gerar arquivo Excel
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  return excelBlob;
};

// Função para executar o script Python e gerar PPT usando dados diretos
export const gerarPropostaLocal = async (dadosProjeto, projecoesFinanceiras) => {
  try {
    console.log('🎯 Gerando proposta localmente com dados diretos...');

    // Executar script Python via fetch para endpoint local
    const response = await fetch('http://localhost:8000/gerar-proposta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dadosProjeto,
        projecoesFinanceiras
      })
    });

    if (!response.ok) {
      throw new Error('Erro ao gerar proposta');
    }

    const result = await response.json();
    
    // Fazer download dos arquivos gerados
    if (result.pptBase64) {
      const pptBlob = new Blob([Uint8Array.from(atob(result.pptBase64), c => c.charCodeAt(0))], 
        { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      saveAs(pptBlob, `proposta_${dadosProjeto.cliente || 'cliente'}.pptx`);
    }

    if (result.pdfBase64) {
      const pdfBlob = new Blob([Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0))], 
        { type: 'application/pdf' });
      saveAs(pdfBlob, `proposta_${dadosProjeto.cliente || 'cliente'}.pdf`);
    }

    return { success: true, message: 'Proposta gerada com sucesso!' };

  } catch (error) {
    console.error('❌ Erro ao gerar proposta local:', error);
    return { success: false, message: 'Erro ao gerar proposta: ' + error.message };
  }
};
