// Precificador Culinário - App State Management and UI

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
    outrasDesepesas: 0
  },
  insumos: [],
  subReceitas: [],
  receitas: [],
  currentPage: 'wizard',
  wizardStep: 0,
  isInitialized: false
};

// Utility Functions
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
};

const formatPercentage = (value) => {
  return `${(value || 0).toFixed(2)}%`;
};

const generateId = () => {
  return Date.now() + Math.random().toString(36).substr(2, 9);
};

// Cost Calculation Functions
const calculateInsumoUnitCost = (insumo) => {
  return insumo.precoCompra / insumo.quantidadeCompra;
};

const calculateSubReceitaCost = (subReceita) => {
  let totalCost = 0;
  subReceita.ingredientes.forEach(ingrediente => {
    const insumo = appState.insumos.find(i => i.id === ingrediente.insumoId);
    if (insumo) {
      const unitCost = calculateInsumoUnitCost(insumo);
      totalCost += unitCost * ingrediente.quantidade;
    }
  });
  return totalCost / subReceita.rendimento;
};

const calculateReceitaCost = (receita) => {
  let totalCost = 0;
  receita.componentes.forEach(componente => {
    if (componente.tipo === 'insumo') {
      const insumo = appState.insumos.find(i => i.id === componente.refId);
      if (insumo) {
        const unitCost = calculateInsumoUnitCost(insumo);
        totalCost += unitCost * componente.quantidade;
      }
    } else if (componente.tipo === 'sub') {
      const subReceita = appState.subReceitas.find(sr => sr.id === componente.refId);
      if (subReceita) {
        const unitCost = calculateSubReceitaCost(subReceita);
        totalCost += unitCost * componente.quantidade;
      }
    }
  });
  return totalCost / receita.rendimento;
};

const calculateReceitaPrice = (receita) => {
  const cost = calculateReceitaCost(receita);
  return cost * (1 + receita.markup / 100);
};

// DRE Calculations
const calculateDREData = () => {
  const receitaBruta = appState.dre.receitaBrutaMensal;
  const deducoes = receitaBruta * (appState.dre.percentualDeducoes / 100);
  const receitaLiquida = receitaBruta - deducoes;
  
  // CMV (Cost of Goods Sold) - simplified calculation
  const cmv = appState.receitas.reduce((total, receita) => {
    return total + calculateReceitaCost(receita);
  }, 0);
  
  const lucroBruto = receitaLiquida - cmv;
  
  const despesasOperacionais = appState.dre.salarios + appState.dre.energia + 
                               appState.dre.aluguel + appState.dre.outrasDesepesas;
  
  const resultadoAntes = lucroBruto - despesasOperacionais - appState.dre.impostosFixosMensais;
  
  return {
    receitaBruta,
    deducoes,
    receitaLiquida,
    cmv,
    lucroBruto,
    despesasOperacionais,
    impostosFixos: appState.dre.impostosFixosMensais,
    resultadoAntes
  };
};

// Modal Functions
const showModal = (title, formHTML, onSave) => {
  const modal = document.getElementById('modal');
  const backdrop = document.getElementById('modal-backdrop');
  const modalTitle = document.getElementById('modal-title');
  const modalForm = document.getElementById('modal-form');
  
  modalTitle.textContent = title;
  modalForm.innerHTML = formHTML;
  
  modal.classList.remove('hidden');
  backdrop.classList.remove('hidden');
  
  // Focus first input
  setTimeout(() => {
    const firstInput = modalForm.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
  }, 100);
  
  // Clear previous handlers and set new save handler
  const saveBtn = document.getElementById('modal-save');
  saveBtn.onclick = null;
  saveBtn.onclick = () => {
    if (onSave()) {
      hideModal();
    }
  };
};

const hideModal = () => {
  const modal = document.getElementById('modal');
  const backdrop = document.getElementById('modal-backdrop');
  modal.classList.add('hidden');
  backdrop.classList.add('hidden');
  
  // Clear save button handler
  const saveBtn = document.getElementById('modal-save');
  if (saveBtn) {
    saveBtn.onclick = null;
  }
};

// Wizard Functions
const wizardSteps = [
  {
    title: 'Informações da Empresa',
    fields: [
      { name: 'nomeEmpresa', label: 'Nome da Empresa', type: 'text', required: true }
    ]
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
      { name: 'salarios', label: 'Salários (R$)', type: 'number', step: '0.01', required: true },
      { name: 'energia', label: 'Energia (R$)', type: 'number', step: '0.01', required: true },
      { name: 'aluguel', label: 'Aluguel (R$)', type: 'number', step: '0.01', required: true },
      { name: 'outrasDesepesas', label: 'Outras Despesas (R$)', type: 'number', step: '0.01', required: true }
    ]
  }
];

const renderWizardStep = () => {
  const step = wizardSteps[appState.wizardStep];
  const form = document.getElementById('wizard-form');
  const title = document.getElementById('wizard-title');
  const prevBtn = document.getElementById('wizard-prev');
  const nextBtn = document.getElementById('wizard-next');
  
  title.textContent = step.title;
  
  // Render progress steps
  let stepsHTML = '<div class="wizard-steps">';
  wizardSteps.forEach((_, index) => {
    const stepClass = index === appState.wizardStep ? 'active' : 
                     index < appState.wizardStep ? 'completed' : '';
    stepsHTML += `<div class="wizard-step ${stepClass}">Passo ${index + 1}</div>`;
  });
  stepsHTML += '</div>';
  
  // Render form fields
  let fieldsHTML = stepsHTML;
  step.fields.forEach(field => {
    const value = appState.dre[field.name] || '';
    fieldsHTML += `
      <div class="form-group">
        <label class="form-label">${field.label}</label>
        <input 
          type="${field.type}" 
          name="${field.name}" 
          value="${value}"
          step="${field.step || ''}"
          class="form-control" 
          ${field.required ? 'required' : ''}
        />
      </div>
    `;
  });
  
  form.innerHTML = fieldsHTML;
  
  // Button states
  prevBtn.classList.toggle('hidden', appState.wizardStep === 0);
  nextBtn.textContent = appState.wizardStep === wizardSteps.length - 1 ? 'Concluir' : 'Próximo';
};

const nextWizardStep = (e) => {
  e.preventDefault();
  
  const form = document.getElementById('wizard-form');
  const formData = new FormData(form);
  
  // Validate and save current step
  const step = wizardSteps[appState.wizardStep];
  let isValid = true;
  
  step.fields.forEach(field => {
    const value = formData.get(field.name);
    if (field.required && !value) {
      isValid = false;
      return;
    }
    
    if (field.type === 'number') {
      appState.dre[field.name] = parseFloat(value) || 0;
    } else {
      appState.dre[field.name] = value;
    }
  });
  
  if (!isValid) {
    alert('Por favor, preencha todos os campos obrigatórios.');
    return;
  }
  
  if (appState.wizardStep < wizardSteps.length - 1) {
    appState.wizardStep++;
    renderWizardStep();
  } else {
    // Complete wizard
    appState.isInitialized = true;
    appState.currentPage = 'dashboard';
    renderApp();
  }
};

const prevWizardStep = (e) => {
  e.preventDefault();
  
  if (appState.wizardStep > 0) {
    appState.wizardStep--;
    renderWizardStep();
  }
};

// Page Rendering Functions
const renderDashboard = () => {
  const dreData = calculateDREData();
  
  return `
    <div class="card">
      <div class="card__body">
        <h2>Dashboard - ${appState.dre.nomeEmpresa}</h2>
        
        <div class="card-grid mt-8">
          <div class="card metric-card">
            <div class="card__body">
              <div class="metric-value">${formatCurrency(dreData.receitaLiquida)}</div>
              <div class="metric-label">Receita Líquida</div>
            </div>
          </div>
          
          <div class="card metric-card">
            <div class="card__body">
              <div class="metric-value">${formatCurrency(dreData.cmv)}</div>
              <div class="metric-label">CMV</div>
            </div>
          </div>
          
          <div class="card metric-card">
            <div class="card__body">
              <div class="metric-value">${formatCurrency(dreData.lucroBruto)}</div>
              <div class="metric-label">Lucro Bruto</div>
            </div>
          </div>
          
          <div class="card metric-card">
            <div class="card__body">
              <div class="metric-value">${formatCurrency(dreData.resultadoAntes)}</div>
              <div class="metric-label">Resultado</div>
            </div>
          </div>
        </div>
        
        <div class="flex gap-16 mt-8">
          <div class="card">
            <div class="card__body">
              <h3>Resumo de Dados</h3>
              <p><strong>Insumos:</strong> ${appState.insumos.length}</p>
              <p><strong>Sub-receitas:</strong> ${appState.subReceitas.length}</p>
              <p><strong>Receitas:</strong> ${appState.receitas.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

const renderInsumos = () => {
  let tableHTML = `
    <div class="action-bar">
      <h2>Insumos</h2>
      <button class="btn btn--primary" onclick="showInsumoForm()">Adicionar Insumo</button>
    </div>
    
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Unidade</th>
            <th>Qtd. Compra</th>
            <th>Preço Compra</th>
            <th>Custo Unitário</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  if (appState.insumos.length === 0) {
    tableHTML += `
      <tr>
        <td colspan="6" class="empty-state">
          <h3>Nenhum insumo cadastrado</h3>
          <p>Clique em "Adicionar Insumo" para começar</p>
        </td>
      </tr>
    `;
  } else {
    appState.insumos.forEach(insumo => {
      const unitCost = calculateInsumoUnitCost(insumo);
      tableHTML += `
        <tr>
          <td>${insumo.nome}</td>
          <td>${insumo.unidade}</td>
          <td>${insumo.quantidadeCompra}</td>
          <td>${formatCurrency(insumo.precoCompra)}</td>
          <td class="cost-display">${formatCurrency(unitCost)}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn--sm btn--outline" onclick="editInsumo('${insumo.id}')">Editar</button>
              <button class="btn btn--sm btn--outline" onclick="deleteInsumo('${insumo.id}')">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    });
  }
  
  tableHTML += `
        </tbody>
      </table>
    </div>
  `;
  
  return tableHTML;
};

const renderSubReceitas = () => {
  let tableHTML = `
    <div class="action-bar">
      <h2>Sub-receitas</h2>
      <button class="btn btn--primary" onclick="showSubReceitaForm()">Adicionar Sub-receita</button>
    </div>
    
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Rendimento</th>
            <th>Ingredientes</th>
            <th>Custo Unitário</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  if (appState.subReceitas.length === 0) {
    tableHTML += `
      <tr>
        <td colspan="5" class="empty-state">
          <h3>Nenhuma sub-receita cadastrada</h3>
          <p>Clique em "Adicionar Sub-receita" para começar</p>
        </td>
      </tr>
    `;
  } else {
    appState.subReceitas.forEach(subReceita => {
      const unitCost = calculateSubReceitaCost(subReceita);
      const ingredientesText = subReceita.ingredientes.map(ing => {
        const insumo = appState.insumos.find(i => i.id === ing.insumoId);
        return insumo ? `${insumo.nome} (${ing.quantidade}${insumo.unidade})` : 'Insumo não encontrado';
      }).join(', ');
      
      tableHTML += `
        <tr>
          <td>${subReceita.nome}</td>
          <td>${subReceita.rendimento}</td>
          <td>${ingredientesText}</td>
          <td class="cost-display">${formatCurrency(unitCost)}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn--sm btn--outline" onclick="editSubReceita('${subReceita.id}')">Editar</button>
              <button class="btn btn--sm btn--outline" onclick="deleteSubReceita('${subReceita.id}')">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    });
  }
  
  tableHTML += `
        </tbody>
      </table>
    </div>
  `;
  
  return tableHTML;
};

const renderReceitas = () => {
  let tableHTML = `
    <div class="action-bar">
      <h2>Receitas Finais</h2>
      <button class="btn btn--primary" onclick="showReceitaForm()">Adicionar Receita</button>
    </div>
    
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Rendimento</th>
            <th>Componentes</th>
            <th>Custo</th>
            <th>Markup</th>
            <th>Preço Venda</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  if (appState.receitas.length === 0) {
    tableHTML += `
      <tr>
        <td colspan="7" class="empty-state">
          <h3>Nenhuma receita cadastrada</h3>
          <p>Clique em "Adicionar Receita" para começar</p>
        </td>
      </tr>
    `;
  } else {
    appState.receitas.forEach(receita => {
      const cost = calculateReceitaCost(receita);
      const price = calculateReceitaPrice(receita);
      
      const componentesText = receita.componentes.map(comp => {
        if (comp.tipo === 'insumo') {
          const insumo = appState.insumos.find(i => i.id === comp.refId);
          return insumo ? `${insumo.nome} (${comp.quantidade}${insumo.unidade})` : 'Insumo não encontrado';
        } else {
          const subReceita = appState.subReceitas.find(sr => sr.id === comp.refId);
          return subReceita ? `${subReceita.nome} (${comp.quantidade}un)` : 'Sub-receita não encontrada';
        }
      }).join(', ');
      
      tableHTML += `
        <tr>
          <td>${receita.nome}</td>
          <td>${receita.rendimento}</td>
          <td>${componentesText}</td>
          <td class="cost-display">${formatCurrency(cost)}</td>
          <td>${formatPercentage(receita.markup)}</td>
          <td class="price-display">${formatCurrency(price)}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn--sm btn--outline" onclick="editReceita('${receita.id}')">Editar</button>
              <button class="btn btn--sm btn--outline" onclick="deleteReceita('${receita.id}')">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    });
  }
  
  tableHTML += `
        </tbody>
      </table>
    </div>
  `;
  
  return tableHTML;
};

const renderDRE = () => {
  const dreData = calculateDREData();
  
  return `
    <div class="action-bar">
      <h2>DRE - Demonstração do Resultado do Exercício</h2>
      <button class="btn btn--secondary" onclick="exportDRE()">Exportar CSV</button>
    </div>
    
    <div class="card">
      <div class="card__body">
        <h3>${appState.dre.nomeEmpresa}</h3>
        
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Receita Bruta</strong></td>
                <td>${formatCurrency(dreData.receitaBruta)}</td>
              </tr>
              <tr>
                <td>(-) Deduções</td>
                <td>${formatCurrency(dreData.deducoes)}</td>
              </tr>
              <tr>
                <td><strong>Receita Líquida</strong></td>
                <td>${formatCurrency(dreData.receitaLiquida)}</td>
              </tr>
              <tr>
                <td>(-) CMV</td>
                <td>${formatCurrency(dreData.cmv)}</td>
              </tr>
              <tr>
                <td><strong>Lucro Bruto</strong></td>
                <td>${formatCurrency(dreData.lucroBruto)}</td>
              </tr>
              <tr>
                <td>(-) Despesas Operacionais</td>
                <td>${formatCurrency(dreData.despesasOperacionais)}</td>
              </tr>
              <tr>
                <td>(-) Impostos Fixos</td>
                <td>${formatCurrency(dreData.impostosFixos)}</td>
              </tr>
              <tr>
                <td><strong>Resultado antes do IR</strong></td>
                <td class="${dreData.resultadoAntes >= 0 ? 'cost-display' : 'status--error'}">${formatCurrency(dreData.resultadoAntes)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
};

// Form Functions
window.showInsumoForm = (id = null) => {
  const insumo = id ? appState.insumos.find(i => i.id === id) : null;
  const title = insumo ? 'Editar Insumo' : 'Novo Insumo';
  
  const formHTML = `
    <div class="form-group">
      <label class="form-label">Nome</label>
      <input type="text" name="nome" value="${insumo?.nome || ''}" class="form-control" required>
    </div>
    
    <div class="form-group">
      <label class="form-label">Unidade</label>
      <select name="unidade" class="form-control" required>
        <option value="">Selecione...</option>
        <option value="g" ${insumo?.unidade === 'g' ? 'selected' : ''}>Gramas (g)</option>
        <option value="ml" ${insumo?.unidade === 'ml' ? 'selected' : ''}>Mililitros (ml)</option>
        <option value="un" ${insumo?.unidade === 'un' ? 'selected' : ''}>Unidades (un)</option>
        <option value="kg" ${insumo?.unidade === 'kg' ? 'selected' : ''}>Quilogramas (kg)</option>
        <option value="l" ${insumo?.unidade === 'l' ? 'selected' : ''}>Litros (l)</option>
      </select>
    </div>
    
    <div class="form-group">
      <label class="form-label">Quantidade de Compra</label>
      <input type="number" name="quantidadeCompra" value="${insumo?.quantidadeCompra || ''}" step="0.01" class="form-control" required>
    </div>
    
    <div class="form-group">
      <label class="form-label">Preço de Compra (R$)</label>
      <input type="number" name="precoCompra" value="${insumo?.precoCompra || ''}" step="0.01" class="form-control" required>
    </div>
  `;
  
  showModal(title, formHTML, () => {
    const form = document.getElementById('modal-form');
    const formData = new FormData(form);
    
    const data = {
      nome: formData.get('nome'),
      unidade: formData.get('unidade'),
      quantidadeCompra: parseFloat(formData.get('quantidadeCompra')),
      precoCompra: parseFloat(formData.get('precoCompra'))
    };
    
    // Validation
    if (!data.nome || !data.unidade || !data.quantidadeCompra || !data.precoCompra) {
      alert('Por favor, preencha todos os campos.');
      return false;
    }
    
    if (insumo) {
      // Update existing
      const index = appState.insumos.findIndex(i => i.id === id);
      appState.insumos[index] = { ...insumo, ...data };
    } else {
      // Create new
      appState.insumos.push({ id: generateId(), ...data });
    }
    
    renderCurrentPage();
    return true;
  });
};

window.showSubReceitaForm = (id = null) => {
  const subReceita = id ? appState.subReceitas.find(sr => sr.id === id) : null;
  const title = subReceita ? 'Editar Sub-receita' : 'Nova Sub-receita';
  
  let ingredientesHTML = '';
  if (subReceita && subReceita.ingredientes) {
    subReceita.ingredientes.forEach((ing, index) => {
      ingredientesHTML += `
        <div class="component-item" data-index="${index}">
          <select name="ingrediente_${index}" class="form-control" required>
            <option value="">Selecione um insumo...</option>
            ${appState.insumos.map(insumo => 
              `<option value="${insumo.id}" ${ing.insumoId === insumo.id ? 'selected' : ''}>${insumo.nome} (${insumo.unidade})</option>`
            ).join('')}
          </select>
          <input type="number" name="quantidade_${index}" value="${ing.quantidade}" step="0.01" placeholder="Quantidade" class="form-control" required>
          <button type="button" class="btn btn--sm btn--outline" onclick="removeIngrediente(${index})">Remover</button>
        </div>
      `;
    });
  }
  
  const formHTML = `
    <div class="form-group">
      <label class="form-label">Nome</label>
      <input type="text" name="nome" value="${subReceita?.nome || ''}" class="form-control" required>
    </div>
    
    <div class="form-group">
      <label class="form-label">Rendimento</label>
      <input type="number" name="rendimento" value="${subReceita?.rendimento || ''}" step="0.01" class="form-control" required>
    </div>
    
    <div class="form-group">
      <label class="form-label">Ingredientes</label>
      <div id="ingredientes-container" class="component-selector">
        ${ingredientesHTML}
      </div>
      <button type="button" class="btn btn--sm btn--secondary mt-8" onclick="addIngrediente()">Adicionar Ingrediente</button>
    </div>
  `;
  
  showModal(title, formHTML, () => {
    const form = document.getElementById('modal-form');
    const formData = new FormData(form);
    
    const data = {
      nome: formData.get('nome'),
      rendimento: parseFloat(formData.get('rendimento')),
      ingredientes: []
    };
    
    // Collect ingredients
    let index = 0;
    while (formData.get(`ingrediente_${index}`) !== null) {
      const insumoId = formData.get(`ingrediente_${index}`);
      const quantidade = parseFloat(formData.get(`quantidade_${index}`));
      
      if (insumoId && quantidade) {
        data.ingredientes.push({ insumoId, quantidade });
      }
      index++;
    }
    
    // Validation
    if (!data.nome || !data.rendimento || data.ingredientes.length === 0) {
      alert('Por favor, preencha todos os campos e adicione pelo menos um ingrediente.');
      return false;
    }
    
    if (subReceita) {
      // Update existing
      const index = appState.subReceitas.findIndex(sr => sr.id === id);
      appState.subReceitas[index] = { ...subReceita, ...data };
    } else {
      // Create new
      appState.subReceitas.push({ id: generateId(), ...data });
    }
    
    renderCurrentPage();
    return true;
  });
};

window.showReceitaForm = (id = null) => {
  const receita = id ? appState.receitas.find(r => r.id === id) : null;
  const title = receita ? 'Editar Receita' : 'Nova Receita';
  
  let componentesHTML = '';
  if (receita && receita.componentes) {
    receita.componentes.forEach((comp, index) => {
      componentesHTML += `
        <div class="component-item" data-index="${index}">
          <select name="tipo_${index}" class="form-control" required onchange="updateComponentOptions(${index})">
            <option value="">Selecione o tipo...</option>
            <option value="insumo" ${comp.tipo === 'insumo' ? 'selected' : ''}>Insumo</option>
            <option value="sub" ${comp.tipo === 'sub' ? 'selected' : ''}>Sub-receita</option>
          </select>
          <select name="componente_${index}" class="form-control" required>
            <option value="">Selecione...</option>
            ${comp.tipo === 'insumo' ? 
              appState.insumos.map(insumo => 
                `<option value="${insumo.id}" ${comp.refId === insumo.id ? 'selected' : ''}>${insumo.nome} (${insumo.unidade})</option>`
              ).join('') :
              appState.subReceitas.map(subReceita => 
                `<option value="${subReceita.id}" ${comp.refId === subReceita.id ? 'selected' : ''}>${subReceita.nome}</option>`
              ).join('')
            }
          </select>
          <input type="number" name="quantidade_${index}" value="${comp.quantidade}" step="0.01" placeholder="Quantidade" class="form-control" required>
          <button type="button" class="btn btn--sm btn--outline" onclick="removeComponente(${index})">Remover</button>
        </div>
      `;
    });
  }
  
  const formHTML = `
    <div class="form-group">
      <label class="form-label">Nome</label>
      <input type="text" name="nome" value="${receita?.nome || ''}" class="form-control" required>
    </div>
    
    <div class="form-group">
      <label class="form-label">Rendimento</label>
      <input type="number" name="rendimento" value="${receita?.rendimento || ''}" step="0.01" class="form-control" required>
    </div>
    
    <div class="form-group">
      <label class="form-label">Markup (%)</label>
      <input type="number" name="markup" value="${receita?.markup || ''}" step="0.01" class="form-control" required>
    </div>
    
    <div class="form-group">
      <label class="form-label">Componentes</label>
      <div id="componentes-container" class="component-selector">
        ${componentesHTML}
      </div>
      <button type="button" class="btn btn--sm btn--secondary mt-8" onclick="addComponente()">Adicionar Componente</button>
    </div>
  `;
  
  showModal(title, formHTML, () => {
    const form = document.getElementById('modal-form');
    const formData = new FormData(form);
    
    const data = {
      nome: formData.get('nome'),
      rendimento: parseFloat(formData.get('rendimento')),
      markup: parseFloat(formData.get('markup')),
      componentes: []
    };
    
    // Collect components
    let index = 0;
    while (formData.get(`tipo_${index}`) !== null) {
      const tipo = formData.get(`tipo_${index}`);
      const refId = formData.get(`componente_${index}`);
      const quantidade = parseFloat(formData.get(`quantidade_${index}`));
      
      if (tipo && refId && quantidade) {
        data.componentes.push({ tipo, refId, quantidade });
      }
      index++;
    }
    
    // Validation
    if (!data.nome || !data.rendimento || data.markup === '' || data.componentes.length === 0) {
      alert('Por favor, preencha todos os campos e adicione pelo menos um componente.');
      return false;
    }
    
    if (receita) {
      // Update existing
      const index = appState.receitas.findIndex(r => r.id === id);
      appState.receitas[index] = { ...receita, ...data };
    } else {
      // Create new
      appState.receitas.push({ id: generateId(), ...data });
    }
    
    renderCurrentPage();
    return true;
  });
};

// Helper functions for forms
let ingredienteCounter = 0;
let componenteCounter = 0;

window.addIngrediente = () => {
  const container = document.getElementById('ingredientes-container');
  const index = ingredienteCounter++;
  
  const div = document.createElement('div');
  div.className = 'component-item';
  div.setAttribute('data-index', index);
  div.innerHTML = `
    <select name="ingrediente_${index}" class="form-control" required>
      <option value="">Selecione um insumo...</option>
      ${appState.insumos.map(insumo => 
        `<option value="${insumo.id}">${insumo.nome} (${insumo.unidade})</option>`
      ).join('')}
    </select>
    <input type="number" name="quantidade_${index}" step="0.01" placeholder="Quantidade" class="form-control" required>
    <button type="button" class="btn btn--sm btn--outline" onclick="removeIngrediente(${index})">Remover</button>
  `;
  
  container.appendChild(div);
};

window.removeIngrediente = (index) => {
  const container = document.getElementById('ingredientes-container');
  const item = container.querySelector(`[data-index="${index}"]`);
  if (item) {
    container.removeChild(item);
  }
};

window.addComponente = () => {
  const container = document.getElementById('componentes-container');
  const index = componenteCounter++;
  
  const div = document.createElement('div');
  div.className = 'component-item';
  div.setAttribute('data-index', index);
  div.innerHTML = `
    <select name="tipo_${index}" class="form-control" required onchange="updateComponentOptions(${index})">
      <option value="">Selecione o tipo...</option>
      <option value="insumo">Insumo</option>
      <option value="sub">Sub-receita</option>
    </select>
    <select name="componente_${index}" class="form-control" required>
      <option value="">Selecione...</option>
    </select>
    <input type="number" name="quantidade_${index}" step="0.01" placeholder="Quantidade" class="form-control" required>
    <button type="button" class="btn btn--sm btn--outline" onclick="removeComponente(${index})">Remover</button>
  `;
  
  container.appendChild(div);
};

window.removeComponente = (index) => {
  const container = document.getElementById('componentes-container');
  const item = container.querySelector(`[data-index="${index}"]`);
  if (item) {
    container.removeChild(item);
  }
};

window.updateComponentOptions = (index) => {
  const tipoSelect = document.querySelector(`select[name="tipo_${index}"]`);
  const componenteSelect = document.querySelector(`select[name="componente_${index}"]`);
  
  componenteSelect.innerHTML = '<option value="">Selecione...</option>';
  
  if (tipoSelect.value === 'insumo') {
    appState.insumos.forEach(insumo => {
      const option = document.createElement('option');
      option.value = insumo.id;
      option.textContent = `${insumo.nome} (${insumo.unidade})`;
      componenteSelect.appendChild(option);
    });
  } else if (tipoSelect.value === 'sub') {
    appState.subReceitas.forEach(subReceita => {
      const option = document.createElement('option');
      option.value = subReceita.id;
      option.textContent = subReceita.nome;
      componenteSelect.appendChild(option);
    });
  }
};

// Delete functions
window.deleteInsumo = (id) => {
  if (confirm('Tem certeza que deseja excluir este insumo?')) {
    appState.insumos = appState.insumos.filter(i => i.id !== id);
    renderCurrentPage();
  }
};

window.deleteSubReceita = (id) => {
  if (confirm('Tem certeza que deseja excluir esta sub-receita?')) {
    appState.subReceitas = appState.subReceitas.filter(sr => sr.id !== id);
    renderCurrentPage();
  }
};

window.deleteReceita = (id) => {
  if (confirm('Tem certeza que deseja excluir esta receita?')) {
    appState.receitas = appState.receitas.filter(r => r.id !== id);
    renderCurrentPage();
  }
};

// Edit functions
window.editInsumo = (id) => showInsumoForm(id);
window.editSubReceita = (id) => showSubReceitaForm(id);
window.editReceita = (id) => showReceitaForm(id);

// Export function
window.exportDRE = () => {
  const dreData = calculateDREData();
  const csvData = [
    ['Conta', 'Valor'],
    ['Receita Bruta', dreData.receitaBruta],
    ['Deduções', dreData.deducoes],
    ['Receita Líquida', dreData.receitaLiquida],
    ['CMV', dreData.cmv],
    ['Lucro Bruto', dreData.lucroBruto],
    ['Despesas Operacionais', dreData.despesasOperacionais],
    ['Impostos Fixos', dreData.impostosFixos],
    ['Resultado antes do IR', dreData.resultadoAntes]
  ];
  
  const csvContent = csvData.map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `DRE_${appState.dre.nomeEmpresa}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Navigation functions
const navigateTo = (page) => {
  if (!appState.isInitialized && page !== 'wizard') {
    return;
  }
  
  appState.currentPage = page;
  renderApp();
};

const renderCurrentPage = () => {
  const pages = ['dashboard', 'insumos', 'subreceitas', 'receitas', 'dre'];
  
  pages.forEach(page => {
    const pageElement = document.getElementById(page);
    if (pageElement) {
      pageElement.classList.add('hidden');
    }
  });
  
  const currentPageElement = document.getElementById(appState.currentPage);
  if (currentPageElement) {
    currentPageElement.classList.remove('hidden');
    
    switch (appState.currentPage) {
      case 'dashboard':
        currentPageElement.innerHTML = renderDashboard();
        break;
      case 'insumos':
        currentPageElement.innerHTML = renderInsumos();
        break;
      case 'subreceitas':
        currentPageElement.innerHTML = renderSubReceitas();
        break;
      case 'receitas':
        currentPageElement.innerHTML = renderReceitas();
        break;
      case 'dre':
        currentPageElement.innerHTML = renderDRE();
        break;
    }
  }
  
  // Update navigation buttons
  document.querySelectorAll('.navbar [data-route]').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.route === appState.currentPage) {
      btn.classList.add('active');
    }
  });
};

const renderApp = () => {
  const wizard = document.getElementById('wizard');
  const mainApp = document.getElementById('main-app');
  
  if (!appState.isInitialized) {
    wizard.classList.remove('hidden');
    mainApp.classList.add('hidden');
    renderWizardStep();
  } else {
    wizard.classList.add('hidden');
    mainApp.classList.remove('hidden');
    renderCurrentPage();
  }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Ensure modal is properly hidden on page load
  const modal = document.getElementById('modal');
  const backdrop = document.getElementById('modal-backdrop');
  if (modal && backdrop) {
    modal.classList.add('hidden');
    backdrop.classList.add('hidden');
  }
  
  // Wizard navigation
  const wizardNext = document.getElementById('wizard-next');
  const wizardPrev = document.getElementById('wizard-prev');
  
  if (wizardNext) {
    wizardNext.addEventListener('click', nextWizardStep);
  }
  
  if (wizardPrev) {
    wizardPrev.addEventListener('click', prevWizardStep);
  }
  
  // Navigation
  document.querySelectorAll('.navbar [data-route]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(btn.dataset.route);
    });
  });
  
  // Modal
  const modalCancel = document.getElementById('modal-cancel');
  const modalBackdrop = document.getElementById('modal-backdrop');
  
  if (modalCancel) {
    modalCancel.addEventListener('click', hideModal);
  }
  
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', hideModal);
  }
  
  // Initial render
  renderApp();
});