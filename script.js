document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const grid = document.getElementById('sudokuGrid');
    const solveBtn = document.getElementById('solveBtn');
    const clearBtn = document.getElementById('clearBtn');
    const modal = document.getElementById('modal');
    const closeModal = document.getElementById('closeModal');
    const virtualKeyboard = document.getElementById('virtualKeyboard');
    const themeToggle = document.getElementById('themeToggle');
    const modalMessage = document.getElementById('modalMessage');
    const htmlElement = document.documentElement;

    // Константы
    const SERVER_URL = 'https://almorozov.pythonanywhere.com';
    const SERVER_TIMEOUT = 5000;
    
    // Состояние приложения
    let isSolving = false;
    let activeCell = null;
    let currentTheme = localStorage.getItem('theme') || 'dark';
    let currentConflicts = new Map();
    let useServer = true;
    let keyboardVisible = false;

    // Проверка доступности сервера
    async function checkServerAvailability() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`${SERVER_URL}/health`, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                useServer = true;
                console.log('✅ Сервер доступен');
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Сервер недоступен, используется клиентская логика');
            useServer = false;
        }
        return false;
    }

    // Инициализация темы
    function initTheme() {
        htmlElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('theme', currentTheme);
        
        // Обновляем иконку темы
        themeToggle.textContent = currentTheme === 'dark' ? '🌙' : '☀️';
    }

    // Переключение темы
    function toggleTheme() {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        initTheme();
        
        themeToggle.style.transform = 'scale(0.9)';
        setTimeout(() => {
            themeToggle.style.transform = 'scale(1)';
        }, 150);
    }

    // Показать модальное окно
    function showModal(message = 'Судоку не имеет решения', title = 'Ошибка') {
        modalMessage.textContent = message;
        modal.querySelector('.modal-title').textContent = title;
        modal.style.display = 'flex';
        
        // Добавляем класс для анимации
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }

    // Скрыть модальное окно
    function hideModal() {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    // Создание сетки
    function createGrid() {
        grid.innerHTML = '';
        
        for (let i = 0; i < 81; i++) {
            const cell = document.createElement('div');
            cell.className = 'sudoku-cell';
            cell.dataset.index = i;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.inputMode = 'numeric';
            input.maxLength = 1;
            input.className = 'cell-input';
            input.dataset.index = i;
            
            cell.appendChild(input);
            
            // Обработчики событий
            cell.addEventListener('click', () => handleCellClick(cell));
            input.addEventListener('focus', () => handleCellClick(cell));
            input.addEventListener('input', (e) => handleCellInput(e.target));
            input.addEventListener('keydown', (e) => handleCellKeydown(e.target, e));
            
            grid.appendChild(cell);
        }
    }

    // Обработчик клика по ячейке
    function handleCellClick(cell) {
        if (isSolving) return;
        
        // Убираем активность со всех ячеек
        document.querySelectorAll('.sudoku-cell').forEach(c => {
            c.classList.remove('active');
        });
        
        // Активируем текущую ячейку
        cell.classList.add('active');
        activeCell = cell;
        
        // Если клавиатура не видна, фокусируемся на инпуте
        if (!keyboardVisible) {
            const input = cell.querySelector('.cell-input');
            input.focus();
        }
    }

    // Обработчик ввода в ячейку
    function handleCellInput(input) {
        if (isSolving) return;
        
        // Разрешаем только цифры 1-9
        if (!/^[1-9]?$/.test(input.value)) {
            input.value = '';
        } else if (input.value !== '') {
            input.parentElement.classList.add('user-input');
            input.parentElement.classList.remove('solved');
        }
        
        // Проверяем конфликты
        setTimeout(() => checkConflicts(), 50);
    }

    // Обработчик нажатия клавиш
    function handleCellKeydown(input, e) {
        if (isSolving) return;
        
        if (keyboardVisible && window.innerWidth <= 768) {
            e.preventDefault();
            return;
        }
        
        const index = parseInt(input.parentElement.dataset.index);
        
        // Управление стрелками
        if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            navigateGrid(e.key, index);
        }
        
        // Ввод цифр
        if (/^[1-9]$/.test(e.key)) {
            e.preventDefault();
            input.value = e.key;
            input.parentElement.classList.add('user-input');
            input.parentElement.classList.remove('solved');
            setTimeout(() => checkConflicts(), 50);
        }
        
        // Удаление
        if (e.key === 'Backspace' || e.key === 'Delete') {
            input.value = '';
            input.parentElement.classList.remove('user-input', 'solved');
            setTimeout(() => checkConflicts(), 50);
        }
        
        // Enter для решения
        if (e.key === 'Enter') {
            e.preventDefault();
            solveSudoku();
        }
        
        // Escape для отмены
        if (e.key === 'Escape') {
            if (activeCell) {
                activeCell.classList.remove('active');
                activeCell = null;
            }
        }
    }

    // Навигация по сетке
    function navigateGrid(direction, currentIndex) {
        let newIndex = currentIndex;
        
        switch(direction) {
            case 'ArrowUp':
                newIndex = currentIndex - 9;
                if (newIndex < 0) newIndex += 81;
                break;
            case 'ArrowDown':
                newIndex = currentIndex + 9;
                if (newIndex >= 81) newIndex -= 81;
                break;
            case 'ArrowLeft':
                newIndex = currentIndex - 1;
                if (Math.floor(newIndex / 9) !== Math.floor(currentIndex / 9)) {
                    newIndex = currentIndex + 8;
                }
                break;
            case 'ArrowRight':
                newIndex = currentIndex + 1;
                if (Math.floor(newIndex / 9) !== Math.floor(currentIndex / 9)) {
                    newIndex = currentIndex - 8;
                }
                break;
        }
        
        if (newIndex >= 0 && newIndex < 81) {
            const newCell = grid.children[newIndex];
            handleCellClick(newCell);
            
            if (!keyboardVisible) {
                const input = newCell.querySelector('.cell-input');
                input.focus();
            }
        }
    }

    // Получение текущего состояния доски
    function getBoard() {
        const board = [];
        
        for (let i = 0; i < 81; i++) {
            const cell = grid.children[i];
            const input = cell.querySelector('.cell-input');
            const value = input.value.trim();
            board.push(value === '' ? 0 : parseInt(value, 10));
        }
        
        return board;
    }

    // Проверка валидности числа
    function isValid(board, row, col, num) {
        for (let x = 0; x < 9; x++) {
            if (board[row * 9 + x] === num) return false;
        }
        
        for (let y = 0; y < 9; y++) {
            if (board[y * 9 + col] === num) return false;
        }
        
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[(startRow + i) * 9 + (startCol + j)] === num) return false;
            }
        }
        
        return true;
    }

    // Проверка конфликтов
    function checkConflicts() {
        const board = getBoard();
        currentConflicts.clear();
        
        // Убираем все конфликты
        document.querySelectorAll('.sudoku-cell').forEach(cell => {
            cell.classList.remove('conflict');
        });
        
        // Проверяем строки
        for (let row = 0; row < 9; row++) {
            const seen = new Set();
            for (let col = 0; col < 9; col++) {
                const index = row * 9 + col;
                const value = board[index];
                if (value !== 0) {
                    if (seen.has(value)) {
                        // Помечаем все одинаковые числа в строке
                        for (let c = 0; c < 9; c++) {
                            const idx = row * 9 + c;
                            if (board[idx] === value) {
                                currentConflicts.set(idx, true);
                                grid.children[idx].classList.add('conflict');
                            }
                        }
                    }
                    seen.add(value);
                }
            }
        }
        
        // Проверяем столбцы
        for (let col = 0; col < 9; col++) {
            const seen = new Set();
            for (let row = 0; row < 9; row++) {
                const index = row * 9 + col;
                const value = board[index];
                if (value !== 0) {
                    if (seen.has(value)) {
                        // Помечаем все одинаковые числа в столбце
                        for (let r = 0; r < 9; r++) {
                            const idx = r * 9 + col;
                            if (board[idx] === value) {
                                currentConflicts.set(idx, true);
                                grid.children[idx].classList.add('conflict');
                            }
                        }
                    }
                    seen.add(value);
                }
            }
        }
        
        // Проверяем блоки 3x3
        for (let blockRow = 0; blockRow < 3; blockRow++) {
            for (let blockCol = 0; blockCol < 3; blockCol++) {
                const seen = new Set();
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        const row = blockRow * 3 + i;
                        const col = blockCol * 3 + j;
                        const index = row * 9 + col;
                        const value = board[index];
                        
                        if (value !== 0) {
                            if (seen.has(value)) {
                                // Помечаем все одинаковые числа в блоке
                                for (let x = 0; x < 3; x++) {
                                    for (let y = 0; y < 3; y++) {
                                        const r = blockRow * 3 + x;
                                        const c = blockCol * 3 + y;
                                        const idx = r * 9 + c;
                                        if (board[idx] === value) {
                                            currentConflicts.set(idx, true);
                                            grid.children[idx].classList.add('conflict');
                                        }
                                    }
                                }
                            }
                            seen.add(value);
                        }
                    }
                }
            }
        }
    }

    // Настройка виртуальной клавиатуры
    function setupVirtualKeyboard() {
        virtualKeyboard.querySelectorAll('.number-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (isSolving) return;
                
                e.preventDefault();
                const number = btn.dataset.number;
                
                if (activeCell) {
                    const input = activeCell.querySelector('.cell-input');
                    
                    if (number === '0') {
                        // Удаление
                        input.value = '';
                        activeCell.classList.remove('user-input', 'solved');
                    } else {
                        // Ввод цифры
                        input.value = number;
                        activeCell.classList.add('user-input');
                        activeCell.classList.remove('solved');
                    }
                    
                    // Анимация нажатия
                    btn.style.transform = 'scale(0.9)';
                    setTimeout(() => {
                        btn.style.transform = '';
                    }, 150);
                    
                    // Проверяем конфликты
                    setTimeout(() => checkConflicts(), 50);
                }
            });
            
            // Touch события для мобилок
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                btn.style.opacity = '0.7';
                btn.style.transform = 'scale(0.95)';
            });
            
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                btn.style.opacity = '1';
                btn.style.transform = '';
            });
            
            btn.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                btn.style.opacity = '1';
                btn.style.transform = '';
            });
        });
    }

    // Обновление видимости клавиатуры
    function updateKeyboardVisibility() {
        const width = window.innerWidth;
        const isMobile = width <= 767; // Показываем только на мобилках
        
        if (isMobile) {
            virtualKeyboard.classList.add('show');
            keyboardVisible = true;
            
            // Делаем инпуты readOnly чтобы не показывалась системная клавиатура
            document.querySelectorAll('.cell-input').forEach(input => {
                input.readOnly = true;
                input.setAttribute('inputmode', 'none');
            });
        } else {
            virtualKeyboard.classList.remove('show');
            keyboardVisible = false;
            
            // Возвращаем возможность ввода с клавиатуры
            document.querySelectorAll('.cell-input').forEach(input => {
                input.readOnly = false;
                input.setAttribute('inputmode', 'numeric');
            });
        }
    }

    // Решение судоку
    async function solveSudoku() {
        if (isSolving) return;
        
        // Проверяем наличие конфликтов
        if (currentConflicts.size > 0) {
            showModal('Исправьте конфликты перед решением!', 'Конфликты обнаружены');
            return;
        }
        
        // Проверяем, есть ли введенные цифры
        const board = getBoard();
        const hasInput = board.some(cell => cell !== 0);
        
        if (!hasInput) {
            showModal('Введите хотя бы одну цифру в судоку!', 'Внимание');
            return;
        }
        
        isSolving = true;
        solveBtn.disabled = true;
        solveBtn.textContent = 'Решаем...';
        
        try {
            let solution = null;
            let solvedBy = 'javascript';
            
            // Пытаемся решить на сервере
            if (useServer) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), SERVER_TIMEOUT);
                    
                    const response = await fetch(`${SERVER_URL}/solve`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ board: board }),
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const result = await response.json();
                        if (result.solved && result.board) {
                            solution = result.board;
                            solvedBy = result.server || 'python';
                            console.log('✅ Решено на сервере');
                        }
                    }
                } catch (error) {
                    console.log('⚠️ Не удалось решить на сервере');
                }
            }
            
            // Если сервер не сработал, решаем на клиенте
            if (!solution) {
                const clientSolution = solveClient(board);
                if (clientSolution.solved) {
                    solution = clientSolution.board;
                    console.log('✅ Решено на клиенте');
                } else {
                    showModal(clientSolution.message, 'Ошибка');
                    isSolving = false;
                    solveBtn.disabled = false;
                    solveBtn.textContent = 'Решить';
                    return;
                }
            }
            
            // Анимация решения
            await animateSolution(solution, solvedBy);
            
        } catch (error) {
            console.error('❌ Ошибка при решении:', error);
            showModal('Произошла ошибка при решении судоку', 'Ошибка');
        } finally {
            isSolving = false;
            solveBtn.disabled = false;
            solveBtn.textContent = 'Решить';
        }
    }

    // Клиентский решатель
    function solveClient(board) {
        const boardCopy = [...board];
        
        // Проверяем на валидность
        for (let i = 0; i < 81; i++) {
            if (boardCopy[i] !== 0) {
                const row = Math.floor(i / 9);
                const col = i % 9;
                const num = boardCopy[i];
                boardCopy[i] = 0;
                
                if (!isValid(boardCopy, row, col, num)) {
                    return { solved: false, message: 'Некорректное судоку' };
                }
                
                boardCopy[i] = num;
            }
        }
        
        // Решаем
        const solved = solveSudokuRecursive(boardCopy);
        
        return {
            solved: solved,
            board: solved ? boardCopy : null,
            message: solved ? 'Судоку решено' : 'Судоку не имеет решения'
        };
    }

    // Рекурсивное решение
    function solveSudokuRecursive(board) {
        // Ищем пустую ячейку
        let emptyIndex = -1;
        for (let i = 0; i < 81; i++) {
            if (board[i] === 0) {
                emptyIndex = i;
                break;
            }
        }
        
        // Если нет пустых ячеек - судоку решено
        if (emptyIndex === -1) return true;
        
        const row = Math.floor(emptyIndex / 9);
        const col = emptyIndex % 9;
        
        // Пробуем цифры от 1 до 9
        for (let num = 1; num <= 9; num++) {
            if (isValid(board, row, col, num)) {
                board[emptyIndex] = num;
                
                if (solveSudokuRecursive(board)) {
                    return true;
                }
                
                // Откат
                board[emptyIndex] = 0;
            }
        }
        
        return false;
    }

    // Анимация решения
    async function animateSolution(solution, source = 'javascript') {
        const originalBoard = getBoard();
        
        // Собираем ячейки для заполнения
        const cellsToSolve = [];
        for (let i = 0; i < 81; i++) {
            if (originalBoard[i] === 0 && solution[i] !== 0) {
                const cell = grid.children[i];
                cellsToSolve.push({ cell: cell, index: i });
            }
        }
        
        // Заполняем с анимацией
        for (let i = 0; i < cellsToSolve.length; i++) {
            if (!isSolving) break;
            
            const { cell, index } = cellsToSolve[i];
            const input = cell.querySelector('.cell-input');
            
            // Небольшая задержка для анимации
            await new Promise(resolve => setTimeout(resolve, 20));
            
            input.value = solution[index];
            cell.classList.add('solved');
            cell.classList.remove('user-input', 'conflict');
        }
        
        console.log(`✅ Судоку решено (${source})`);
    }

    // Очистка сетки
    function clearGrid() {
        if (isSolving) return;
        
        for (let i = 0; i < 81; i++) {
            const cell = grid.children[i];
            const input = cell.querySelector('.cell-input');
            
            input.value = '';
            cell.classList.remove('user-input', 'solved', 'active', 'conflict');
        }
        
        activeCell = null;
        currentConflicts.clear();
        
        // Активируем первую ячейку
        setTimeout(() => {
            if (grid.children[0]) {
                handleCellClick(grid.children[0]);
            }
        }, 50);
    }

    // Инициализация приложения
    async function init() {
        createGrid();
        setupVirtualKeyboard();
        initTheme();
        
        // Настройка видимости клавиатуры
        updateKeyboardVisibility();
        
        // Обработчики событий
        solveBtn.addEventListener('click', solveSudoku);
        clearBtn.addEventListener('click', clearGrid);
        themeToggle.addEventListener('click', toggleTheme);
        closeModal.addEventListener('click', hideModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideModal();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (modal.style.display === 'flex') {
                    hideModal();
                } else if (activeCell) {
                    activeCell.classList.remove('active');
                    activeCell = null;
                }
            }
            
            // Горячие клавиши (только если модальное окно не открыто)
            if (e.ctrlKey && modal.style.display !== 'flex') {
                switch(e.key) {
                    case 'r':
                        e.preventDefault();
                        if (!isSolving) clearGrid();
                        break;
                    case 'Enter':
                        e.preventDefault();
                        if (!isSolving) solveSudoku();
                        break;
                    case 't':
                        e.preventDefault();
                        toggleTheme();
                        break;
                }
            }
        });
        
        // Обновляем видимость клавиатуры при изменении размера
        window.addEventListener('resize', updateKeyboardVisibility);
        window.addEventListener('orientationchange', () => {
            setTimeout(updateKeyboardVisibility, 100);
        });
        
        // Проверка сервера
        await checkServerAvailability();
        
        // Активируем первую ячейку
        setTimeout(() => {
            if (grid.children[0]) {
                handleCellClick(grid.children[0]);
            }
        }, 100);
        
        console.log('🚀 SUDO.RESH запущен');
        console.log(`🔧 Режим: ${useServer ? 'Серверный' : 'Клиентский'}`);
    }

    // Запуск
    init();
});
