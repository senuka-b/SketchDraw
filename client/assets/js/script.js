import { PageHandler } from "./pageHandler.js ";


let createRoomForm;
let enterRoomCodeForm;

let leaveGameBtn;
let canvas;
let clearCanvasBtn;
let brushSizeSlider;
let timerElement;
let chatInput;
let chatContainer;
let toolsContainer;

let gameTime = 60;
let timerInterval;
let sizeDisplay;
let ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = 'black';
let currentSize = 5;

const socket = io();

let sessionData = {
    game: {
        drew: [],
        currentWord: null,
        currentDrawer: null,
        round: 1,
        timer: 60,
        users: [],
        isActive: false
    },
    guessed: false,
    username: null,
    score: 0,
};

function initalizeSocketListeners() {
    socket.on("user-joined", (data) => {

        sessionData.game.users = data.users;

        if (!sessionData.username) { // New user

            PageHandler.loadContent('canvas', data);
        } else { // Old user
            renderUsers();
        }

    });

    socket.on("user-left", (data) => {
        if (!(data.users.map((user) => user.username).includes(sessionData.username))) {
            sessionData = {
                game: {
                    currentWord: null,
                    drew: [],
                    currentWord: null,
                    currentDrawer: null,
                    round: 1,
                    timer: 60,
                    isActive: false
                },
                guessed: false,
                username: null,
                color: 0,
                score: 0,
                messages: []
            };

            PageHandler.loadContent('init');
            return;
        }

        sessionData.game.users = data.users;
        renderUsers();
    });

    socket.on("error", (code) => {
        if (code === 404) {
            alert('Room not found');
        }
    });

    socket.on("game-started", (gameData) => {

        sessionData.game = { users: sessionData.game.users, ...gameData };
        console.log("Game started ! ", sessionData.game);


        function checkAndInitialize() {
            const toolsContainer = document.getElementById('tool-container');
            if (toolsContainer) {
                toggleToolBarVisibility();
                renderUsers();
            } else {
                // Retry after a delay
                setTimeout(checkAndInitialize, 100);
            }
        }

        checkAndInitialize();


    });

    socket.on("timer", (timer) => {
        timerElement = document.getElementById('timer');;

        if (timer <= 10) {
            timerElement.style.color = '#f44336'; // Red
        } else if (gameTime <= 30) {
            timerElement.style.color = '#ff9800'; // Orange
        } else {
            timerElement.style.color = '#4caf50'; // Green
        }


        timerElement.textContent = timer + "s";
    });

    socket.on("round-over", () => {
        alert('Round ended!');

        // TODO: Next player
    });

    socket.on("message", (data) => {
        console.log("Message received:", data);

        renderMessage(data.message, data.username);
    });

    socket.on("draw", (data) => {

        if (data.username === sessionData.username) return;

        drawOnCanvas(data.x, data.y, data.color, data.size);
    });

    socket.on("drawing-status", (data) => {
        if (data.clearCanvas) return clearCanvas();

        isDrawing = data.isDrawing;

        if (data.lastX && data.lastY) {
            lastX = data.lastX;
            lastY = data.lastY;
        }
    });

}


document.addEventListener('DOMContentLoaded', () => {
    initalizeSocketListeners();
})


function init(page, room) {

    if (page === 'init') {

        // Room codes
        createRoomForm = document.querySelector('#createRoomForm');
        enterRoomCodeForm = document.querySelector('#roomCodeForm');

        createRoomForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const roomCode = document.querySelector('#textFieldCreateRoomCode').value;

            fetch('/create-room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ roomCode, user: socket.id })
            })
                .then(response => response.json())
                .then(data => {
                    if (data["error"]) {
                        alert(data.error);
                        return;
                    }

                    socket.emit("join-room", data);

                })
                .catch(error => {
                    console.error('Error creating room:', error);
                });
        });

        enterRoomCodeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const roomCode = document.querySelector('#textFieldRoomCode').value;
            socket.emit("join-room", { roomCode });
        });
    }

    else if (page === 'canvas') {
        console.log('room data', room);

        console.log("New user");

        sessionData.username = room.username;

        leaveGameBtn = document.getElementById('leave-game');
        chatInput = document.getElementById('chat-input');
        chatContainer = document.getElementById('chat-messages');
        toolsContainer = document.getElementById('tool-container');

        console.log("Load canvas : " + toolsContainer);

        leaveGameBtn.addEventListener('click', () => {
            socket.emit("leave-room");
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                socket.emit("chat", e.target.value);
                e.target.value = '';
            }
        });

        document.getElementById('roomCode').innerHTML = room.roomCode;

        setupDrawingArea();
        renderUsers();
    }


}


function renderMessage(message, username) {
    chatContainer.innerHTML +=
        `<div class="chat-message">
            <div class="chat-author ls-size-5 chat-header-${sessionData.game.users.find(user => user.username === username).color}">${username}</div>
            <div class="chat-body">${message}</div>
        </div>`;
}

function renderUsers() {
    const usersContainer = document.getElementById('user-container');
    usersContainer.innerHTML = '';
    sessionData.game.users.forEach(user => {
        usersContainer.innerHTML += `
            <div class="player-card">
                <div class="player-avatar avatar-${user.color} 
                    ${user.username === sessionData.game.currentDrawer ? 'currently-drawing' : ''}
                    ">${user.username[0]}</div>
                <div class="player-info">
                    <div class="player-name">${user.username} ${user.username === sessionData.username ? '(You)' : ''}</div>
                    <div class="player-score">${user.points}</div>
                </div>
            </div>
            
    `;
    });



}

function setupDrawingArea() {
    setupCanvas(true);
    setupColorPicker();
    setupBrushSize();
}

function toggleToolBarVisibility() {


    toolsContainer = document.getElementById('tool-container');

    console.log("tools container " + toolsContainer);

    if (sessionData.username === sessionData.game.currentDrawer) {
        ; console.log("is current drawer!");

        Array.from(toolsContainer.children).forEach(tool => {
            tool.classList.remove('hidden');
            toggleColorPickerVisibility(false);

        });
    } else {
        Array.from(toolsContainer.children).forEach(tool => {
            tool.classList.add('hidden');
            toggleColorPickerVisibility(true)
        });

        console.log("HIDDEN USER");
        disableCanvas();
    }





}

function toggleColorPickerVisibility(add) {
    const colorPicker = document.querySelector('.color-picker');
    Array.from(colorPicker.children).forEach(tool => {
        if (add) tool.classList.add('hidden');
        else tool.classList.remove('hidden');
    })
}

function setupCanvas() {

    canvas = document.getElementById('drawing-canvas');
    ctx = canvas.getContext('2d');
    clearCanvasBtn = document.getElementById('clear-canvas');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    clearCanvasBtn.addEventListener('click', clearCanvas);
}

function disableCanvas() {
    canvas.removeEventListener('mousedown', startDrawing);
    canvas.removeEventListener('mousemove', draw);
    canvas.removeEventListener('mouseup', stopDrawing);
    canvas.removeEventListener('mouseout', stopDrawing);

}


function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;

    socket.emit("drawing-status", { isDrawing, lastX, lastY });
}

function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    lastX = currentX;
    lastY = currentY;

    socket.emit('draw', { x: currentX, y: currentY, color: currentColor, size: currentSize });
}

function drawOnCanvas(x, y, color = "black", size = 2) {
    if (!isDrawing) return;

    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;

}

function stopDrawing() {
    isDrawing = false;
    socket.emit("drawing-status", { isDrawing });
}

function clearCanvas() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    socket.emit("drawing-status", { clearCanvas: true });
}

function setupColorPicker() {
    const colorOptions = document.querySelectorAll('.color-option');

    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            colorOptions.forEach(opt => opt.classList.remove('selected'));

            option.classList.add('selected');

            currentColor = option.getAttribute('data-color');
        });
    });
}

function setupBrushSize() {
    brushSizeSlider = document.querySelector('#brush-size');
    sizeDisplay = document.querySelector('#size-display');

    brushSizeSlider.addEventListener('input', () => {
        currentSize = brushSizeSlider.value;
        sizeDisplay.textContent = `${currentSize}px`;
    });
}


function startTimer() {

    clearInterval(timerInterval);
    gameTime = 60;
    timerElement.textContent = gameTime;

    timerInterval = setInterval(() => {
        gameTime--;
        timerElement.textContent = gameTime + "s";

        if (gameTime <= 10) {
            timerElement.style.color = '#f44336'; // Red
        } else if (gameTime <= 30) {
            timerElement.style.color = '#ff9800'; // Orange
        } else {
            timerElement.style.color = '#4caf50'; // Green
        }

        if (gameTime <= 0) {
            clearInterval(timerInterval);
            setTimeout(() => {
                alert('Round ended!');

                // TODO: Next player

            }, 500);
        }
    }, 1000);
}


export { init };