import { PageHandler } from "./pageHandler.js ";


let createRoomForm;
let enterRoomCodeForm;

let canvas;
let clearCanvasBtn;
let brushSizeSlider;
let timerElement;

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
        currentWord: null,
        currentDrawer: null,
        isActive: false,
        users: []
    },
    username: null,
    color: 0,
    score: 0,
};

function initalizeSocketListeners() {
    socket.on("user-joined", (data) => {
        PageHandler.loadContent('canvas', data);
    });

    socket.on("error", (code) => {
        if (code === 404) {
            alert('Room not found');
        }
    });

    socket.on("game-started", (gameData) => {

    });

}

function init(page, room) {
    initalizeSocketListeners();

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

                    socket.emit("join-room", data, true);

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

        document.getElementById('roomCode').innerHTML = room.roomCode;

        if (!sessionData.username) {
            sessionData.username = room.username;
        }

        sessionData.game.users = room.users;

        setupDrawingArea();
        renderUsers();
    }


}

function renderUsers() {
    const usersContainer = document.getElementById('user-container');
    usersContainer.innerHTML = '';
    sessionData.game.users.forEach(user => {
        usersContainer.innerHTML += `
            <div class="player-card currently-drawing">
                <div class="player-avatar avatar-1">${user.username[0]}</div>
                <div class="player-info">
                    <div class="player-name">${user.username} ${user.username === sessionData.username ? '(You)' : ''}</div>
                    <div class="player-score">${user.points}</div>
                </div>
            </div>
            
    `;
    });



}

function setupDrawingArea() {
    setupCanvas();
    setupColorPicker();
    setupBrushSize();
    startTimer();
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


function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
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
}

function stopDrawing() {
    isDrawing = false;
}

function clearCanvas() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    timerElement = document.getElementById('timer');;

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