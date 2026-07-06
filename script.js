// ---------- State ----------
const COLUMNS_KEY = 'kanban_columns';
let columns = [];
let draggedCard = null;
let draggedCardData = null;
let currentColumnId = null;

// DOM refs
const boardEl = document.getElementById('board');
const cardModal = document.getElementById('cardModal');
const columnModal = document.getElementById('columnModal');
const cardForm = document.getElementById('cardForm');
const columnForm = document.getElementById('columnForm');
const cardInput = document.getElementById('cardInput');
const columnInput = document.getElementById('columnInput');
const addColumnBtn = document.getElementById('addColumnBtn');

// ---------- Storage ----------
function loadData() {
  const stored = localStorage.getItem(COLUMNS_KEY);
  if (stored) {
    try {
      columns = JSON.parse(stored);
    } catch (_) {
      columns = getDefaultColumns();
    }
  } else {
    columns = getDefaultColumns();
  }
}

function saveData() {
  localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
}

function getDefaultColumns() {
  return [
    { id: 'col-1', title: 'To Do', cards: ['Learn Kanban', 'Set up project'] },
    { id: 'col-2', title: 'Doing', cards: ['Build UI'] },
    { id: 'col-3', title: 'Done', cards: ['Read Wikipedia article'] },
  ];
}

// ---------- Helpers ----------
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---------- Render ----------
function renderBoard() {
  boardEl.innerHTML = '';
  columns.forEach((col, index) => {
    const colEl = createColumnElement(col, index);
    boardEl.appendChild(colEl);
  });
}

function createColumnElement(col, index) {
  const colDiv = document.createElement('div');
  colDiv.className = 'column';
  colDiv.dataset.columnId = col.id;

  // Header
  const header = document.createElement('div');
  header.className = 'column-header';
  header.innerHTML = `
    <div class="column-title">
      <span>${escapeHtml(col.title)}</span>
      <span class="badge">${col.cards.length}</span>
    </div>
    <div class="column-actions">
      <button class="edit-column" title="Edit column">✏️</button>
      <button class="delete-column" title="Delete column">🗑️</button>
    </div>
  `;
  colDiv.appendChild(header);

  // Card list (drop zone)
  const list = document.createElement('div');
  list.className = 'card-list';
  list.dataset.columnId = col.id;

  // Cards
  col.cards.forEach((cardText, cardIndex) => {
    const cardEl = createCardElement(cardText, col.id, cardIndex);
    list.appendChild(cardEl);
  });

  colDiv.appendChild(list);

  // Add card button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-card-btn';
  addBtn.innerHTML = '+ Add a card';
  addBtn.dataset.columnId = col.id;
  addBtn.addEventListener('click', () => openCardModal(col.id));
  colDiv.appendChild(addBtn);

  // Column actions
  const editBtn = header.querySelector('.edit-column');
  const deleteBtn = header.querySelector('.delete-column');

  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const newTitle = prompt('Edit column title:', col.title);
    if (newTitle !== null && newTitle.trim() !== '') {
      col.title = newTitle.trim();
      saveData();
      renderBoard();
    }
  });

  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Delete column "${col.title}" and all its cards?`)) {
      columns.splice(index, 1);
      saveData();
      renderBoard();
    }
  });

  // Drag & drop events on the list (drop zone)
  list.addEventListener('dragover', handleDragOver);
  list.addEventListener('dragenter', handleDragEnter);
  list.addEventListener('dragleave', handleDragLeave);
  list.addEventListener('drop', handleDrop);

  return colDiv;
}

function createCardElement(text, columnId, index) {
  const card = document.createElement('div');
  card.className = 'card';
  card.draggable = true;
  card.dataset.columnId = columnId;
  card.dataset.cardIndex = index;

  const textSpan = document.createElement('span');
  textSpan.className = 'card-text';
  textSpan.textContent = text;
  card.appendChild(textSpan);

  const delBtn = document.createElement('button');
  delBtn.className = 'delete-card';
  delBtn.innerHTML = '×';
  delBtn.title = 'Delete card';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCard(columnId, index);
  });
  card.appendChild(delBtn);

  // Drag events
  card.addEventListener('dragstart', handleDragStart);
  card.addEventListener('dragend', handleDragEnd);

  return card;
}

// ---------- Drag & Drop Handlers ----------
function handleDragStart(e) {
  const card = e.target.closest('.card');
  if (!card) return;
  draggedCard = card;
  draggedCardData = {
    columnId: card.dataset.columnId,
    cardIndex: parseInt(card.dataset.cardIndex, 10),
    text: card.querySelector('.card-text').textContent,
  };
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', ''); // required for Firefox
}

function handleDragEnd(e) {
  const card = e.target.closest('.card');
  if (card) card.classList.remove('dragging');
  document.querySelectorAll('.card-list.drag-over').forEach(el => el.classList.remove('drag-over'));
  draggedCard = null;
  draggedCardData = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const list = e.target.closest('.card-list');
  if (list) list.classList.add('drag-over');
}

function handleDragEnter(e) {
  e.preventDefault();
  const list = e.target.closest('.card-list');
  if (list) list.classList.add('drag-over');
}

function handleDragLeave(e) {
  const list = e.target.closest('.card-list');
  if (list && !list.contains(e.relatedTarget)) {
    list.classList.remove('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  const targetList = e.target.closest('.card-list');
  if (!targetList) return;
  targetList.classList.remove('drag-over');

  if (!draggedCardData) return;

  const targetColumnId = targetList.dataset.columnId;
  const sourceColumnId = draggedCardData.columnId;
  const cardIndex = draggedCardData.cardIndex;

  if (sourceColumnId === targetColumnId) {
    // Reorder within same column
    const col = columns.find(c => c.id === sourceColumnId);
    if (!col) return;
    const [removed] = col.cards.splice(cardIndex, 1);
    // Find drop position: where the mouse is over a card or at the end
    const dropTargetCard = e.target.closest('.card');
    let insertIndex = col.cards.length;
    if (dropTargetCard) {
      const targetIndex = parseInt(dropTargetCard.dataset.cardIndex, 10);
      // If dropping after the target card
      insertIndex = targetIndex;
      // Adjust if dragging from before the target in same column
      if (cardIndex < targetIndex) insertIndex = targetIndex - 1;
    }
    // Clamp
    insertIndex = Math.max(0, Math.min(insertIndex, col.cards.length));
    col.cards.splice(insertIndex, 0, removed);
    saveData();
    renderBoard();
  } else {
    // Move to another column
    const sourceCol = columns.find(c => c.id === sourceColumnId);
    const targetCol = columns.find(c => c.id === targetColumnId);
    if (!sourceCol || !targetCol) return;
    const [removed] = sourceCol.cards.splice(cardIndex, 1);
    targetCol.cards.push(removed);
    saveData();
    renderBoard();
  }
}

// ---------- Card Operations ----------
function deleteCard(columnId, cardIndex) {
  const col = columns.find(c => c.id === columnId);
  if (!col) return;
  col.cards.splice(cardIndex, 1);
  saveData();
  renderBoard();
}

function addCard(columnId, text) {
  const col = columns.find(c => c.id === columnId);
  if (!col) return;
  col.cards.push(text.trim());
  saveData();
  renderBoard();
}

function addColumn(title) {
  const newCol = {
    id: 'col-' + generateId(),
    title: title.trim(),
    cards: [],
  };
  columns.push(newCol);
  saveData();
  renderBoard();
}

// ---------- Modals ----------
function openCardModal(columnId) {
  currentColumnId = columnId;
  cardInput.value = '';
  cardModal.classList.remove('hidden');
  cardInput.focus();
}

function closeCardModal() {
  cardModal.classList.add('hidden');
  currentColumnId = null;
}

function openColumnModal() {
  columnInput.value = '';
  columnModal.classList.remove('hidden');
  columnInput.focus();
}

function closeColumnModal() {
  columnModal.classList.add('hidden');
}

// Event listeners for modals
cardForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = cardInput.value.trim();
  if (text && currentColumnId) {
    addCard(currentColumnId, text);
    closeCardModal();
  }
});

columnForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = columnInput.value.trim();
  if (title) {
    addColumn(title);
    closeColumnModal();
  }
});

// Close modals with X or cancel
document.querySelectorAll('.close-modal').forEach(el => {
  el.addEventListener('click', () => {
    closeCardModal();
    closeColumnModal();
  });
});

document.getElementById('cancelModalBtn').addEventListener('click', closeCardModal);
document.getElementById('cancelColumnBtn').addEventListener('click', closeColumnModal);

// Click outside to close
cardModal.addEventListener('click', (e) => {
  if (e.target === cardModal) closeCardModal();
});
columnModal.addEventListener('click', (e) => {
  if (e.target === columnModal) closeColumnModal();
});

// Add column button
addColumnBtn.addEventListener('click', openColumnModal);

// ---------- Escape HTML ----------
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---------- Init ----------
loadData();
renderBoard();
