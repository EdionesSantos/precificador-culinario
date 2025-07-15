// Precificador Culinário – App State Management and UI
// ----------------------------------------------------

// Global State
let appState = {
  dre: {
    nomeEmpresa: '',
    receitaBrutaMensal: 0,
    percentualDeducoes: 0,
    impostosFixosMensais: 0,
    salarios: 0,
    energia: 0,
    aluguel: 0,
    outrasDespesas: 0        // ← nome corrigido
  },
  insumos: [],
  subReceitas: [],
  receitas: [],
  currentPage: 'wizard',
  wizardStep: 0,
  isInitialized: false
};

// Utility Functions
const formatCurrency = value =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);

const formatPercentage = value => `${(value || 0).toFixed(2)}%`;
const generateId = () => Date.now() + Math.random().toString(36).substr(2, 9);

// ----------------------------------------------------
//  CÁLCULOS
// ----------------------------------------------------
const calculateInsumoUnitCost = ins => ins.precoCompra / ins.quantidadeCompra;

const calculateSubReceitaCost = sub => {
  let totalCost = 0;
  sub.ingredientes.forEach(ing => {
    const ins = appState.insumos.find(i => i.id === ing.insumoId);
    if (ins) totalCost += calculateInsumoUnitCost(ins) * ing.quantidade;
  });
  return totalCost / sub.rendimento;
};

const calculateReceitaCost = rec => {
  let total = 0;
  rec.componentes.forEach(comp => {
    if (comp.tipo === 'insumo') {
      const ins = appState.insumos.find(i => i.id === comp.refId);
      if (ins) total += calculateInsumoUnitCost(ins) * comp.quantidade;
    } else {
      const sub = appState.subReceitas.find(s => s.id === comp.refId);
      if (sub) total += calculateSubReceitaCost(sub) * comp.quantidade;
    }
  });
  return total / rec.rendimento;
};

const calculateReceitaPrice = rec =>
  calculateReceitaCost(rec) * (1 + rec.markup / 100);

// DRE
const calculateDREData = () => {
  const rB = appState.dre.receitaBrutaMensal;
  const ded = rB * (appState.dre.percentualDeducoes / 100);
  const rL = rB - ded;
  const cmv = appState.receitas.reduce((t, r) => t + calculateReceitaCost(r), 0);
  const lB = rL - cmv;
  const despOp =
    appState.dre.salarios +
    appState.dre.energia +
    appState.dre.aluguel +
    appState.dre.outrasDespesas;
  const res = lB - despOp - appState.dre.impostosFixosMensais;
  return {
    receitaBruta: rB,
    deducoes: ded,
    receitaLiquida: rL,
    cmv,
    lucroBruto: lB,
    despesasOperacionais: despOp,
    impostosFixos: appState.dre.impostosFixosMensais,
    resultadoAntes: res
  };
};

// ----------------------------------------------------
//  MODAL GENÉRICO
// ----------------------------------------------------
const showModal = (title, formHTML, onSave) => {
  const modal = document.getElementById('modal');
  const backdrop = document.getElementById('modal-backdrop');
  const modalTitle = document.getElementById('modal-title');
  const modalForm = document.getElementById('modal-form');

  modalTitle.textContent = title;
  modalForm.innerHTML = formHTML;

  modal.classList.remove('hidden');
  backdrop.classList.remove('hidden');

  const saveBtn = document.getElementById('modal-save');
  saveBtn.onclick = () => {
    if (onSave()) hideModal();
  };
};

const hideModal = () => {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('modal-backdrop').classList.add('hidden');
  document.getElementById('modal-save').onclick = null;
};

// ----------------------------------------------------
//  ASSISTENTE (WIZARD)
// ----------------------------------------------------
const wizardSteps = [
  {
    title: 'Informações da Empresa',
    fields: [{ name: 'nomeEmpresa', label: 'Nome da Empresa', type: 'text', required: true }]
  },
  {
    title: 'Receitas e Impostos',
    fields: [
      { name: 'receitaBrutaMensal', label: 'Receita Bruta Mensal (R$)', type: 'number', step: '0.01', required: true },
      { name: 'percentualDeducoes', label: 'Deduções (%)', type: 'number', step: '0.01', required: true },
      { name: 'impostosFixosMensais', label: 'Impostos Fixos Mensais (R$)', type: 'number', step: '0.01', required: true }
    ]
  },
  {
    title: 'Despesas Operacionais',
    fields: [
      { name: 'salarios',        label: 'Salários (R$)',         type: 'number', step: '0.01', required: true },
      { name: 'energia',         label: 'Energia (R$)',          type: 'number', step: '0.01', required: true },
      { name: 'aluguel',         label: 'Aluguel (R$)',          type: 'number', step: '0.01', required: true },
      { name: 'outrasDespesas',  label: 'Outras Despesas (R$)',  type: 'number', step: '0.01', required: true }  // ← nome corrigido
    ]
  }
];

const renderWizardStep = () => {
  const step = wizardSteps[appState.wizardStep];

  // Cabeçalho e progressão
  const title = document.getElementById('wizard-title');
  title.textContent = step.title;

  // Renderização dos campos
  const form = document.getElementById('wizard-form');
  let html = '<div class="wizard-steps">';
  wizardSteps.forEach((_, i) => {
    const cls = i === appState.wizardStep ? 'active' : i < appState.wizardStep ? 'completed' : '';
    html += `<div class="wizard-step ${cls}">Passo ${i + 1}</div>`;
  });
  html += '</div>';

  step.fields.forEach(f => {
    const val = appState.dre[f.name] ?? '';
    html += `
      <div class="form-group">
        <label class="form-label">${f.label}</label>
        <input type="${f.type}" step="${f.step || ''}" name="${f.name}" value="${val}" class="form-control" ${f.required ? 'required' : ''}/>
      </div>`;
  });
  form.innerHTML = html;

  // Botões
  document.getElementById('wizard-prev').classList.toggle('hidden', appState.wizardStep === 0);
  document.getElementById('wizard-next').textContent =
    appState.wizardStep === wizardSteps.length - 1 ? 'Concluir' : 'Próximo';
};

const nextWizardStep = e => {
  e.preventDefault();
  const formData = new FormData(document.getElementById('wizard-form'));
  const step = wizardSteps[appState.wizardStep];

  // Validação e persistência
  for (const field of step.fields) {
    const raw = formData.get(field.name);
    if (field.required && !raw) return alert('Preencha todos os campos.');
    appState.dre[field.name] = field.type === 'number' ? parseFloat(raw) || 0 : raw;
  }

  if (appState.wizardStep < wizardSteps.length - 1) {
    appState.wizardStep++;
    renderWizardStep();
  } else {
    appState.isInitialized = true;
    appState.currentPage = 'dashboard';
    renderApp();
  }
};

const prevWizardStep = e => {
  e.preventDefault();
  if (appState.wizardStep > 0) {
    appState.wizardStep--;
    renderWizardStep();
  }
};

// ----------------------------------------------------
//  NAVEGAÇÃO E RENDERIZAÇÃO PRINCIPAL
// ----------------------------------------------------
const navigateTo = page => {
  if (!appState.isInitialized && page !== 'wizard') return;
  appState.currentPage = page;
  renderApp();
};

const renderCurrentPage = () => {
  const pages = ['dashboard', 'insumos', 'subreceitas', 'receitas', 'dre'];
  pages.forEach(p => document.getElementById(p).classList.add('hidden'));

  const el = document.getElementById(appState.currentPage);
  if (!el) return;

  el.classList.remove('hidden');
  switch (appState.currentPage) {
    case 'dashboard':   el.innerHTML = renderDashboard();   break;
    case 'insumos':     el.innerHTML = renderInsumos();     break;
    case 'subreceitas': el.innerHTML = renderSubReceitas(); break;
    case 'receitas':    el.innerHTML = renderReceitas();    break;
    case 'dre':         el.innerHTML = renderDRE();         break;
  }

  // Highlight navegação
  document.querySelectorAll('.navbar [data-route]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === appState.currentPage);
  });
};

const renderApp = () => {
  const wizard = document.getElementById('wizard');
  const main   = document.getElementById('main-app');

  if (!appState.isInitialized) {
    wizard.classList.remove('hidden');
    main.classList.add('hidden');
    renderWizardStep();
  } else {
    wizard.classList.add('hidden');
    main.classList.remove('hidden');
    renderCurrentPage();
  }
};

// ----------------------------------------------------
//  RENDERIZAÇÕES INDIVIDUAIS (Dashboard, Insumos, etc.)
// ----------------------------------------------------
// ... (nenhuma alteração necessária nessas funções)
// As funções renderDashboard, renderInsumos, renderSubReceitas, renderReceitas e renderDRE permanecem iguais.

// ----------------------------------------------------
//  INICIALIZAÇÃO
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('wizard-next').addEventListener('click', nextWizardStep);
  document.getElementById('wizard-prev').addEventListener('click', prevWizardStep);
  document.querySelectorAll('.navbar [data-route]').forEach(btn =>
    btn.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(btn.dataset.route);
    })
  );
  document.getElementById('modal-cancel').addEventListener('click', hideModal);

  renderApp();
});
