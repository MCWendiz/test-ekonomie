const state = {
    allQuestions: [],
    currentPool: [],
    currentIndex: 0,
    // Структура answers: { questionId: { isCorrect: boolean, selection: [indices] } }
    answers: {}, 
    currentSelection: new Set(),
    isAnswered: false,
    mode: 'random'
};

const screens = {
    start: document.getElementById('start-screen'),
    quiz: document.getElementById('quiz-screen')
};

window.addEventListener('DOMContentLoaded', () => {
    if (typeof questionsData === 'undefined') {
        alert('Ошибка: Файл questions.js не найден.');
        return;
    }
    state.allQuestions = questionsData;
    loadProgress();
    setupEventListeners();
});

function setupEventListeners() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.mode = e.target.dataset.mode;
            
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            if(state.mode === 'random') document.getElementById('settings-random').classList.add('active');
            if(state.mode === 'pool') document.getElementById('settings-pool').classList.add('active');
        });
    });

    document.getElementById('start-btn').addEventListener('click', startQuiz);
    document.getElementById('next-btn').addEventListener('click', () => navigate(1));
    document.getElementById('prev-btn').addEventListener('click', () => navigate(-1));
    document.getElementById('show-answer-btn').addEventListener('click', submitAnswer);
    document.getElementById('reset-btn').addEventListener('click', resetCurrentProgress);
    document.getElementById('home-btn').addEventListener('click', () => location.reload());
}

function startQuiz() {
    let pool = [];
    if (state.mode === 'all') {
        pool = [...state.allQuestions];
        shuffleArray(pool);
    } else if (state.mode === 'random') {
        const count = parseInt(document.getElementById('question-count').value) || 20;
        const shuffled = [...state.allQuestions].sort(() => 0.5 - Math.random());
        pool = shuffled.slice(0, count);
    } else if (state.mode === 'pool') {
        const poolIndex = parseInt(document.getElementById('pool-select').value);
        const poolSize = Math.ceil(state.allQuestions.length / 8);
        const start = poolIndex * poolSize;
        pool = state.allQuestions.slice(start, start + poolSize);
    }

    state.currentPool = pool;
    state.currentIndex = 0;
    // Не сбрасываем state.answers полностью, если хотим сохранять между сессиями,
    // но для новой игры лучше сбросить.
    state.answers = {}; 
    localStorage.removeItem('quizProgress');
    
    switchScreen('quiz');
    renderQuestion();
}

function renderQuestion() {
    const q = state.currentPool[state.currentIndex];
    state.currentSelection.clear();
    state.isAnswered = false;

    // Проверяем, отвечали ли мы уже на этот вопрос (история)
    const savedAnswer = state.answers[q.id];

    // UI Сброс
    const btn = document.getElementById('show-answer-btn');
    const resultMsg = document.getElementById('result-message');
    
    // Выводим текст вопроса.
    document.getElementById('question-text').innerText = q.question; 
    // -------------------------------------------

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    resultMsg.className = 'result-message hidden';
    resultMsg.innerText = '';

    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option-item';
        // Кастомный квадрат вместо инпута
        div.innerHTML = `
            <span class="custom-checkbox"></span>
            <div class="opt-text">${opt.text}</div>
        `;
        div.onclick = () => selectOption(div, idx);
        div.dataset.index = idx;
        optionsContainer.appendChild(div);
    });

    // Обновляем прогресс бар
    const progress = ((state.currentIndex + 1) / state.currentPool.length) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('progress-text').innerText = `${state.currentIndex + 1} / ${state.currentPool.length}`;
    updateScoreUI();

    // Если ответ уже есть в истории, восстанавливаем состояние
    if (savedAnswer) {
        state.isAnswered = true;
        savedAnswer.selection.forEach(idx => state.currentSelection.add(idx));
        visualizeResult(q, savedAnswer.selection, savedAnswer.isCorrect);
        btn.style.display = 'none'; 
    } else {
        btn.style.display = 'block';
        btn.disabled = false;
    }
}

function selectOption(el, index) {
    if (state.isAnswered) return; 

    const checkbox = el.querySelector('.custom-checkbox');
    
    if (state.currentSelection.has(index)) {
        state.currentSelection.delete(index);
        el.classList.remove('selected');
    } else {
        state.currentSelection.add(index);
        el.classList.add('selected');
    }
}

function submitAnswer() {
    if (state.isAnswered) return;
    
    const q = state.currentPool[state.currentIndex];
    const selectedIndices = Array.from(state.currentSelection);
    
    // Получаем индексы всех правильных ответов
    const correctIndices = q.options
        .map((opt, idx) => opt.isCorrect ? idx : -1)
        .filter(idx => idx !== -1);

    // Логика проверки:
    // 1. Количество выбранных совпадает с количеством правильных
    // 2. Все выбранные находятся в списке правильных
    const isCorrect = selectedIndices.length === correctIndices.length && 
                      selectedIndices.every(val => correctIndices.includes(val));

    state.isAnswered = true;
    
    // Сохраняем полный объект состояния
    state.answers[q.id] = {
        isCorrect: isCorrect,
        selection: selectedIndices
    };
    saveProgress();
    updateScoreUI();

    visualizeResult(q, selectedIndices, isCorrect);
    
    document.getElementById('show-answer-btn').style.display = 'none';
}

function visualizeResult(q, selectedIndices, isCorrect) {
    const optionDivs = document.getElementById('options-container').children;
    const resultMsg = document.getElementById('result-message');

    // Логика раскраски
    for (let i = 0; i < optionDivs.length; i++) {
        const div = optionDivs[i];
        const isSelected = selectedIndices.includes(i);
        const isActuallyCorrect = q.options[i].isCorrect;
        
        // ВАЖНО: Мы больше НЕ удаляем класс 'selected', чтобы знать, что выбрал юзер
        // div.classList.remove('selected'); <--- удалено
        div.style.cursor = 'default';

        if (isActuallyCorrect) {
            // Правильный ответ всегда зеленый
            div.classList.add('correct');
        } else if (isSelected && !isActuallyCorrect) {
            // Выбранный неправильный - красный
            div.classList.add('wrong');
        }
    }

    // Сообщение на Чешском
    resultMsg.classList.remove('hidden');
    if (isCorrect) {
        resultMsg.innerText = "Správně!";
        resultMsg.classList.add('msg-success');
    } else {
        resultMsg.innerText = "Špatně!";
        resultMsg.classList.add('msg-error');
    }
}

function updateScoreUI() {
    const correctCount = Object.values(state.answers).filter(a => a.isCorrect).length;
    document.getElementById('score-text').innerText = `Правильно: ${correctCount}`;
}

function navigate(dir) {
    const newIndex = state.currentIndex + dir;
    if (newIndex >= 0 && newIndex < state.currentPool.length) {
        state.currentIndex = newIndex;
        renderQuestion();
    }
}

function resetCurrentProgress() {
    if(confirm('Reset stat?')) {
        state.answers = {};
        localStorage.removeItem('quizProgress');
        startQuiz(); 
    }
}

function switchScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function saveProgress() {
    localStorage.setItem('quizProgress', JSON.stringify(state.answers));
}

function loadProgress() {
    const saved = localStorage.getItem('quizProgress');
    if (saved) {
        state.answers = JSON.parse(saved);
    }
}